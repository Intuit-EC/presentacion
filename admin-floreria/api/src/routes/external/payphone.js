const express = require('express');
const { db: prisma } = require('../../lib/prisma');
const {
  createPendingPayphoneOrder,
  finalizePayphoneOrder,
} = require('../../services/payphoneOrderService');
const { businessLog, businessError } = require('../../utils/logger');
const router = express.Router();
const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

function getActivePayphoneCredentials(paymentSettings = {}) {
  const environment = paymentSettings.payphoneEnvironment === 'live' ? 'live' : 'sandbox';
  const prefix = environment === 'live' ? 'payphoneLive' : 'payphoneSandbox';

  return {
    environment,
    token: paymentSettings[`${prefix}Token`] || process.env.PAYPHONE_WEB_TOKEN || process.env.PAYPHONE_TOKEN || '',
    storeId: paymentSettings[`${prefix}StoreId`] || process.env.PAYPHONE_WEB_STORE_ID || process.env.PAYPHONE_STORE_ID || '',
  };
}

function isProductionStoreUrl(value) {
  try {
    const hostname = new URL(String(value || '')).hostname.toLowerCase();
    return hostname === 'difiori.com.ec' || hostname === 'www.difiori.com.ec';
  } catch {
    return false;
  }
}

async function requestPayphoneConfirmation({ token, id, clientTransactionId }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(PAYPHONE_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, clientTxId: clientTransactionId }),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    let data = null;
    try {
      data = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      data = null;
    }

    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

router.get('/health', async (_req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      select: { settings: true },
    });
    const credentials = getActivePayphoneCredentials(company?.settings?.paymentSettings || {});

    return res.status(credentials.token && credentials.storeId ? 200 : 503).json({
      status: credentials.token && credentials.storeId ? 'success' : 'error',
      data: {
        provider: 'PayPhone',
        environment: credentials.environment,
        readyForProduction: credentials.environment === 'live' && Boolean(credentials.token) && Boolean(credentials.storeId),
        tokenConfigured: Boolean(credentials.token),
        storeIdConfigured: Boolean(credentials.storeId),
        sdkVersion: '2.0',
        responseUrl: 'https://difiori.com.ec/payment-result',
      },
    });
  } catch (error) {
    return res.status(503).json({ status: 'error', message: 'No se pudo validar la configuración de PayPhone.' });
  }
});

router.post('/box-session', async (req, res) => {
  const startedAt = Date.now();
  // Verificar si la tienda acepta pedidos
  const company = await prisma.company.findFirst({
    where: { isActive: true },
    select: { settings: true },
  });

  const acceptOrders = company?.settings?.acceptOrders ?? true;
  if (!acceptOrders) {
    return res.status(503).json({
      status: "error",
      message: "Tienda cerrada temporalmente",
    });
  }

  const credentials = getActivePayphoneCredentials(company?.settings?.paymentSettings || {});
  if (!credentials.token || !credentials.storeId) {
    return res.status(503).json({
      status: 'error',
      message: `PayPhone ${credentials.environment} no tiene Token y Store ID completos. Revisa Pagos en el administrador.`,
    });
  }

  if (credentials.environment !== 'live' && isProductionStoreUrl(req.body?.storeUrl)) {
    return res.status(503).json({
      status: 'error',
      message: 'PayPhone está en modo de pruebas y no puede cobrar en la tienda pública. Elige otro método de pago.',
    });
  }

  businessLog("PAYMENT", "PAYPHONE_SESSION_STARTED", {
    customerEmail: req.body?.senderEmail || req.body?.customerEmail || null,
    paymentMethod: "PAYPHONE",
  });

  try {
    const session = await createPendingPayphoneOrder(prisma, {
      ...req.body,
      paymentLabel: 'Tarjeta (PayPhone Box)',
    });

    businessLog("PAYMENT", "PAYPHONE_SESSION_CREATED", {
      orderId: session.order.id,
      orderNumber: session.order.orderNumber,
      clientTransactionId: session.clientTransactionId,
      amountInCents: session.amountInCents,
      durationMs: Date.now() - startedAt,
    });

    return res.status(201).json({
      status: 'success',
      data: {
        orderId: session.order.id,
        orderNumber: session.order.orderNumber,
        clientTransactionId: session.clientTransactionId,
        amount: session.amountInCents,
        amountWithoutTax: session.amountInCents,
        amountWithTax: 0,
        tax: 0,
        currency: 'USD',
        reference: session.order.orderNumber,
        payphoneToken: credentials.token,
        payphoneStoreId: credentials.storeId,
        payphoneEnvironment: credentials.environment,
      },
    });
  } catch (error) {
    businessError("PAYMENT", "PAYPHONE_SESSION_FAILED", error, {
      durationMs: Date.now() - startedAt,
    });
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'No se pudo crear la sesión de pago.',
      detail: process.env.NODE_ENV === 'development' && !error.statusCode ? error.message : undefined,
    });
  }
});

router.post('/confirm', async (req, res) => {
  const startedAt = Date.now();
  const transactionId = Number(req.body?.id);
  const clientTransactionId = String(req.body?.clientTransactionId || req.body?.clientTxId || '').trim();

  if (!Number.isSafeInteger(transactionId) || transactionId <= 0 || !clientTransactionId) {
    return res.status(400).json({ status: 'error', message: 'Datos de confirmación PayPhone inválidos.' });
  }

  try {
    const existingOrder = await prisma.order.findUnique({ where: { clientTransactionId } });
    if (!existingOrder) {
      return res.status(404).json({ status: 'error', message: 'No encontramos la orden asociada al pago.' });
    }

    if (['PAID', 'FAILED', 'CANCELLED'].includes(existingOrder.paymentStatus)) {
      return res.status(200).json({
        status: 'success',
        data: {
          orderNumber: existingOrder.orderNumber,
          paymentStatus: existingOrder.paymentStatus,
          approved: existingOrder.paymentStatus === 'PAID',
          alreadyProcessed: true,
          total: existingOrder.total,
        },
      });
    }

    const company = await prisma.company.findFirst({
      where: { isActive: true },
      select: { settings: true },
    });
    const credentials = getActivePayphoneCredentials(company?.settings?.paymentSettings || {});
    if (!credentials.token) {
      return res.status(503).json({ status: 'error', message: 'PayPhone no tiene un token activo configurado.' });
    }

    const confirmation = await requestPayphoneConfirmation({
      token: credentials.token,
      id: transactionId,
      clientTransactionId,
    });

    if (!confirmation.response.ok || !confirmation.data) {
      businessError('PAYMENT', 'PAYPHONE_CONFIRM_FAILED', new Error('PayPhone rechazó la confirmación.'), {
        statusCode: confirmation.response.status,
        errorCode: confirmation.data?.errorCode || null,
        transactionId,
        clientTransactionId,
        durationMs: Date.now() - startedAt,
      });
      return res.status(502).json({
        status: 'error',
        message: confirmation.data?.message || 'PayPhone no pudo confirmar la transacción. La orden continúa pendiente.',
      });
    }

    if (String(confirmation.data.clientTransactionId || '') !== clientTransactionId) {
      throw Object.assign(new Error('La referencia devuelta por PayPhone no coincide con la orden.'), { statusCode: 409 });
    }

    const finalization = await finalizePayphoneOrder(prisma, {
      clientTransactionId,
      payphoneTransactionId: confirmation.data.transactionId || transactionId,
      transactionStatus: confirmation.data.transactionStatus,
      amount: confirmation.data.amount,
      authorizationCode: confirmation.data.authorizationCode,
    });

    businessLog('PAYMENT', 'PAYPHONE_CONFIRMED', {
      orderNumber: finalization.order.orderNumber,
      paymentStatus: finalization.paymentStatus,
      transactionId,
      clientTransactionId,
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        orderNumber: finalization.order.orderNumber,
        paymentStatus: finalization.paymentStatus,
        approved: finalization.approved,
        alreadyProcessed: finalization.alreadyProcessed,
        total: finalization.order.total,
      },
    });
  } catch (error) {
    businessError('PAYMENT', 'PAYPHONE_CONFIRM_ERROR', error, {
      transactionId,
      clientTransactionId,
      durationMs: Date.now() - startedAt,
    });
    return res.status(error.statusCode || 502).json({
      status: 'error',
      message: error.message || 'No se pudo confirmar el pago; la orden continúa pendiente.',
    });
  }
});

router.post('/finalize', async (req, res) => {
  const startedAt = Date.now();
  const {
    id: payphoneTransactionId,
    clientTransactionId,
    clientTxId,
    transactionStatus,
    amount,
    authorizationCode,
  } = req.body;
  const resolvedClientTxId = clientTxId || clientTransactionId;

  businessLog("PAYMENT", "PAYPHONE_FINALIZE_STARTED", {
    payphoneTransactionId,
    clientTransactionId: resolvedClientTxId,
    transactionStatus,
    amount,
  });

  try {
    const finalization = await finalizePayphoneOrder(prisma, {
      clientTransactionId: resolvedClientTxId,
      payphoneTransactionId,
      transactionStatus,
      amount,
      authorizationCode,
    });

    businessLog("PAYMENT", "PAYPHONE_FINALIZED", {
      orderNumber: finalization.order.orderNumber,
      paymentStatus: finalization.paymentStatus,
      approved: finalization.approved,
      alreadyProcessed: finalization.alreadyProcessed,
      payphoneTransactionId,
      clientTransactionId: resolvedClientTxId,
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        orderNumber: finalization.order.orderNumber,
        paymentStatus: finalization.paymentStatus,
        approved: finalization.approved,
        alreadyProcessed: finalization.alreadyProcessed,
      },
    });
  } catch (error) {
    businessError("PAYMENT", "PAYPHONE_FINALIZE_FAILED", error, {
      payphoneTransactionId,
      clientTransactionId: resolvedClientTxId,
      transactionStatus,
      durationMs: Date.now() - startedAt,
    });
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'No se pudo finalizar el pago.',
      detail: process.env.NODE_ENV === 'development' && !error.statusCode ? error.message : undefined,
    });
  }
});

module.exports = router;
