const express = require("express");
const { db: prisma } = require("../../lib/prisma");
const {
  createPaypalCheckoutOrder,
  capturePaypalCheckoutOrder,
} = require("../../services/paypalOrderService");
const { businessLog, businessError } = require("../../utils/logger");

const router = express.Router();

router.post("/create-order", async (req, res) => {
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

  businessLog("PAYMENT", "PAYPAL_CREATE_STARTED", {
    customerEmail: req.body?.senderEmail || req.body?.customerEmail || null,
    paymentMethod: "PAYPAL",
  });

  try {
    const session = await createPaypalCheckoutOrder(prisma, req.body);

    businessLog("PAYMENT", "PAYPAL_CREATED", {
      orderId: session.order.id,
      orderNumber: session.orderNumber,
      clientTransactionId: session.clientTransactionId,
      paypalOrderId: session.paypalOrderId,
      environment: session.environment,
      durationMs: Date.now() - startedAt,
    });

    return res.status(201).json({
      status: "success",
      data: {
        orderId: session.order.id,
        orderNumber: session.orderNumber,
        clientTransactionId: session.clientTransactionId,
        paypalOrderId: session.paypalOrderId,
        approveUrl: session.approveUrl,
        environment: session.environment,
      },
    });
  } catch (error) {
    businessError("PAYMENT", "PAYPAL_CREATE_FAILED", error, {
      statusCode: error.statusCode,
      durationMs: Date.now() - startedAt,
    });
    return res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "No se pudo crear la orden de PayPal.",
      detail: process.env.NODE_ENV === "development" && !error.statusCode ? error.message : undefined,
    });
  }
});

router.post("/capture", async (req, res) => {
  const startedAt = Date.now();
  const {
    paypalOrderId,
    token,
    clientTransactionId,
    cancelled,
  } = req.body || {};

  businessLog("PAYMENT", "PAYPAL_CAPTURE_STARTED", {
    paypalOrderId: paypalOrderId || token,
    clientTransactionId,
    cancelled: Boolean(cancelled),
  });

  try {
    const result = await capturePaypalCheckoutOrder(prisma, {
      paypalOrderId,
      token,
      clientTransactionId,
      cancelled,
    });

    businessLog("PAYMENT", "PAYPAL_CAPTURED", {
      orderNumber: result.order.orderNumber,
      paymentStatus: result.paymentStatus,
      approved: result.approved,
      alreadyProcessed: result.alreadyProcessed,
      paypalOrderId: result.paypalOrderId || paypalOrderId || token || null,
      captureId: result.captureId || null,
      payerEmail: result.payerEmail || null,
      emailMismatch: Boolean(result.emailMismatch),
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json({
      status: "success",
      data: {
        orderNumber: result.order.orderNumber,
        paymentStatus: result.paymentStatus,
        approved: result.approved,
        alreadyProcessed: result.alreadyProcessed,
        paypalOrderId: result.paypalOrderId || paypalOrderId || token || null,
        captureId: result.captureId || null,
        payerId: result.payerId || null,
        payerEmail: result.payerEmail || null,
        expectedPayerEmail: result.expectedPayerEmail || null,
        emailMismatch: Boolean(result.emailMismatch),
        message: result.emailMismatch
          ? "El correo de PayPal que pago no coincide con el correo ingresado en el checkout."
          : undefined,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    businessError("PAYMENT", "PAYPAL_CAPTURE_FAILED", error, {
      statusCode: error.statusCode,
      durationMs: Date.now() - startedAt,
      paypalOrderId: paypalOrderId || token || null,
      clientTransactionId,
    });
    return res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message || "No se pudo capturar el pago de PayPal.",
      detail: process.env.NODE_ENV === "development" && !error.statusCode ? error.message : undefined,
    });
  }
});

module.exports = router;
