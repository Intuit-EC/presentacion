const express = require('express');
const { db: prisma } = require('../../lib/prisma');
const {
  createPendingPayphoneOrder,
  finalizePayphoneOrder,
} = require('../../services/payphoneOrderService');
const { businessLog, businessError } = require('../../utils/logger');
const router = express.Router();

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
