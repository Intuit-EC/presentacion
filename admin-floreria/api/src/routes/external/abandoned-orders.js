const express = require("express");
const { db: prisma } = require("../../lib/prisma");
const { sendAbandonedCartEmail } = require("../../utils/mail");
const {
  normalizeStorefrontItems,
  hydrateStorefrontItems,
} = require("../../utils/storefrontCartItems");
const { businessLog, businessError } = require("../../utils/logger");
const router = express.Router();

/**
 * POST /api/external/store-orders/abandoned
 * Recibir datos de carrito abandonado y notificar por email
 */
router.post("/", async (req, res) => {
  const startedAt = Date.now();
  try {
    const {
      customerName,
      phone,
      items,
      total,
      senderName,
      senderEmail,
      senderPhone,
      receiverName,
      receiverPhone,
      exactAddress,
      sector,
      paymentMethod,
      deliveryDateTime,
      cardMessage,
      observations,
      couponCode,
      abandonedAt,
      source,
      storeUrl,
    } = req.body;

    if (!customerName || !phone || !items || items.length === 0) {
      return res.status(400).json({ status: "error", message: "Datos incompletos para notificacion de abandono" });
    }

    businessLog("CART", "ABANDONED_RECEIVED", {
      customerName,
      phone,
      senderEmail,
      total: Number(total) || 0,
      itemsCount: Array.isArray(items) ? items.length : 0,
      paymentMethod: paymentMethod || null,
      couponCode: couponCode || null,
      source: source || "CHECKOUT_WEB",
      abandonedAt: abandonedAt || null,
    });

    const company = await prisma.company.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        settings: true,
      },
    });

    if (!company) {
      return res.status(404).json({ status: "error", message: "Empresa no configurada" });
    }

    const normalizedItems = normalizeStorefrontItems(items);
    const hydratedItems = await hydrateStorefrontItems(prisma, normalizedItems);

    const formattedItems = hydratedItems.map((item) => ({
      name: item.productName || "Producto DIFIORI",
      quantity: Number(item.quantity || 1),
      price: item.price || 0,
      image: item.productImage || null,
      productImage: item.productImage || null,
      productId: item.productId || null,
      variantName: item.variantName || null,
    }));

    const paymentSettings = company?.settings && typeof company.settings === "object"
      ? company.settings.paymentSettings || {}
      : {};

    const recentDuplicate = await prisma.abandonedCart.findFirst({
      where: {
        companyId: company.id,
        customerPhone: phone,
        total: Number(total),
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const abandonedCart = recentDuplicate || await prisma.abandonedCart.create({
      data: {
        companyId: company.id,
        customerName,
        customerPhone: phone,
        senderName: senderName || null,
        receiverName: receiverName || null,
        exactAddress: exactAddress || null,
        sector: sector || null,
        paymentMethod: paymentMethod || null,
        deliveryDateTime: deliveryDateTime || null,
        cardMessage: cardMessage || null,
        couponCode: couponCode || null,
        notes: [
          senderEmail ? `Correo envia: ${senderEmail}` : "",
          senderPhone ? `Telefono envia: ${senderPhone}` : "",
          receiverPhone ? `Telefono recibe: ${receiverPhone}` : "",
          observations ? `Observaciones: ${observations}` : "",
        ].filter(Boolean).join(" | ") || null,
        total: Number(total) || 0,
        items: formattedItems,
        source: source || "CHECKOUT_WEB",
        ownerEmail: paymentSettings.ownerNotificationEmail || "ventas@difiori.com.ec",
        abandonedAt: abandonedAt ? new Date(abandonedAt) : new Date(),
      },
    });

    const shouldSendEmail = !recentDuplicate || !recentDuplicate.emailSent;

    const sent = shouldSendEmail
      ? await sendAbandonedCartEmail({
          customerName,
          phone,
          items: formattedItems,
          total: Number(total),
          recipientEmail: paymentSettings.ownerNotificationEmail || "ventas@difiori.com.ec",
          ownerName: paymentSettings.ownerNotificationName || company?.name,
          senderName,
          senderEmail,
          senderPhone,
          receiverName,
          receiverPhone,
          exactAddress,
          sector,
          paymentMethod,
          deliveryDateTime,
          cardMessage,
          observations,
          couponCode,
          abandonedAt,
          source,
          storeUrl,
        })
      : true;

    if (sent && abandonedCart && !abandonedCart.emailSent) {
      await prisma.abandonedCart.update({
        where: { id: abandonedCart.id },
        data: {
          emailSent: true,
        },
      });
    }

    if (sent) {
      businessLog("CART", recentDuplicate ? "ABANDONED_DUPLICATE" : "ABANDONED_CREATED", {
        cartId: abandonedCart.id,
        customerName,
        phone,
        total: Number(total) || 0,
        paymentMethod: paymentMethod || null,
        emailSent: true,
        durationMs: Date.now() - startedAt,
      });

      return res.json({
        status: "success",
        message: "Notificacion de abandono enviada",
        data: {
          id: abandonedCart.id,
        },
      });
    }

    businessError("CART", "ABANDONED_EMAIL_FAILED", "No se pudo enviar notificacion", {
      customerName,
      phone,
      total: Number(total) || 0,
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({ status: "error", message: "Error enviando notificacion" });
  } catch (error) {
    businessError("CART", "ABANDONED_FAILED", error, {
      phone: req.body?.phone,
      customerName: req.body?.customerName,
      durationMs: Date.now() - startedAt,
    });
    console.error("Abandoned order route error:", error);
    res.status(500).json({ status: "error", message: "Error interno" });
  }
});

module.exports = router;
