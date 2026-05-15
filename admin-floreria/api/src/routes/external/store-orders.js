const express = require("express");
const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const { db: prisma } = require("../../lib/prisma");
const emailService = require("../../services/emailService");
const { buildStorefrontOrderDetails } = require("../../utils/storefrontOrderDetails");
const {
  parseStorefrontMoney,
  normalizeStorefrontItems,
  hydrateStorefrontItems,
} = require("../../utils/storefrontCartItems");
const { uploadBuffer } = require("../../services/storageService");
const { businessLog, businessError } = require("../../utils/logger");

const router = express.Router();

function parseMoney(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^0-9,.-]+/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function sanitizeFileName(originalName = "") {
  return String(originalName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function savePaymentProofInOrderNotes(orderId, proofUrl, fileName) {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNotes: true },
  });

  const currentNotes = String(existingOrder?.orderNotes || "");
  const cleanedNotes = currentNotes
    .replace(/\s*\|\s*Comprobante URL:[^|]*/gi, "")
    .replace(/\s*\|\s*Comprobante Archivo:[^|]*/gi, "")
    .trim();
  const fallbackNotes =
    `${cleanedNotes} | Comprobante URL: ${proofUrl} | Comprobante Archivo: ${String(fileName || "comprobante")}`.trim();

  await prisma.order.update({
    where: { id: orderId },
    data: { orderNotes: fallbackNotes },
  });
}

function getExtensionFromMime(mimeType = "") {
  const normalized = String(mimeType).toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("jpg") || normalized.includes("jpeg")) return ".jpg";
  if (normalized.includes("pdf")) return ".pdf";
  return "";
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de comprobante invalido");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

/**
 * POST /api/external/store-orders
 * Crear una orden desde la tienda publica.
 */
router.post("/", async (req, res) => {
  const startedAt = Date.now();

  try {
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

    const {
      productId,
      productName,
      productPrice,
      quantity = 1,
      items: rawItems,
      receiverName,
      receiverPhone,
      senderName,
      senderEmail,
      senderPhone,
      phone,
      deliveryDateTime,
      exactAddress,
      sector,
      shippingCost,
      cardMessage,
      observations,
      paymentMethod,
      total,
      couponCode,
      storeUrl,
    } = req.body;

    businessLog("CHECKOUT", "STARTED", {
      source: "TIENDA_WEB",
      paymentMethod: paymentMethod || "UNKNOWN",
      senderName,
      senderEmail,
      senderPhone,
      receiverName,
      receiverPhone,
      productId: productId || null,
      productName: productName || null,
      quantity: Number(quantity || 1),
      productPrice: parseMoney(productPrice),
      total: parseMoney(total),
      shippingCost: parseMoney(shippingCost),
      couponCode: couponCode || null,
    });

    if (!receiverName || !senderName || !phone || !total) {
      return res.status(400).json({
        status: "error",
        message: "Faltan datos obligatorios: nombre del receptor, emisor, telefono y total.",
      });
    }

    let couponDiscountAmount = 0;
    let couponId = null;
    let appliedCouponCode = null;

    if (couponCode) {
      const now = new Date();
      const coupon = await prisma.coupons.findFirst({
        where: {
          code: String(couponCode).toUpperCase(),
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
      });

      if (coupon) {
        const subtotalBeforeCoupon = parseMoney(total) - parseMoney(shippingCost);
        if (coupon.minAmount && subtotalBeforeCoupon < coupon.minAmount) {
          return res.status(400).json({
            status: "error",
            message: `El cupon requiere una compra minima de $${coupon.minAmount}`,
          });
        }

        couponDiscountAmount =
          coupon.type === "PERCENTAGE"
            ? subtotalBeforeCoupon * (coupon.value / 100)
            : coupon.value;

        couponId = coupon.id;
        appliedCouponCode = coupon.code;
      }
    }

    const orderNumber = `DIFIORI-${Date.now()}`;
    const storefrontDetails = buildStorefrontOrderDetails({
      senderName,
      senderEmail,
      senderPhone,
      receiverName,
      receiverPhone,
      phone,
      deliveryDateTime,
      exactAddress,
      sector,
      cardMessage,
      observations,
      paymentMethod,
    });

    const normalizedItems = normalizeStorefrontItems(rawItems, {
      productId,
      productName,
      productPrice,
      quantity,
    });
    const hydratedItems = await hydrateStorefrontItems(prisma, normalizedItems);

    const order = await prisma.$transaction(async (tx) => {
      const subtotalValue = parseMoney(total) - parseMoney(shippingCost) - couponDiscountAmount;
      const totalValue = parseMoney(total) - couponDiscountAmount;
      const orderNotesValue = `${storefrontDetails.orderNotes}${
        appliedCouponCode
          ? ` | Cupon: ${appliedCouponCode} (-$${couponDiscountAmount.toFixed(2)})`
          : ""
      }`;
      const orderId = crypto.randomUUID().replace(/-/g, "");

      const insertedOrders = await tx.$queryRaw(
        Prisma.sql`
          INSERT INTO "public"."orders" (
            "id",
            "orderNumber",
            "customerName",
            "customerLastName",
            "billingPrincipalAddress",
            "billingSecondAddress",
            "customerReference",
            "subtotal",
            "tax",
            "shipping",
            "total",
            "paymentStatus",
            "status",
            "deliveryNotes",
            "createdAt",
            "source",
            "verifiedWebhook",
            "Courier",
            "billingContactName",
            "customerEmail",
            "orderNotes",
            "customerPhone",
            "total_discount_amount",
            "product_discounted_amount",
            "code_discounted_amount",
            "coupon_discounted_amount",
            "discount_coupon_percent",
            "discount_code_percent",
            "discount_coupon_id",
            "cashOnDelivery",
            "couponDiscountCode"
          )
          VALUES (
            ${orderId},
            ${orderNumber},
            ${senderName.split(" ")[0] || senderName},
            ${senderName.split(" ").slice(1).join(" ") || ""},
            ${storefrontDetails.exactAddress || "No especificado"},
            ${null},
            ${storefrontDetails.observations},
            ${subtotalValue},
            ${0},
            ${parseMoney(shippingCost)},
            ${totalValue},
            ${"PENDING"},
            CAST(${`PENDING`} AS "public"."OrderStatus"),
            ${storefrontDetails.cardMessage},
            ${new Date()},
            ${"TIENDA_WEB"},
            ${false},
            CAST(${`Servientrega`} AS "public"."Courier"),
            ${receiverName},
            ${storefrontDetails.senderEmail},
            ${orderNotesValue},
            ${storefrontDetails.senderPhone},
            ${couponDiscountAmount},
            ${0},
            ${0},
            ${couponDiscountAmount},
            ${null},
            ${null},
            ${couponId},
            ${false},
            ${appliedCouponCode}
          )
          RETURNING "id", "orderNumber", "createdAt"
        `
      );

      const newOrder = insertedOrders[0];

      if (couponId) {
        await tx.coupons.update({
          where: { id: couponId },
          data: { usesTotal: { increment: 1 } },
        });
      }

      const orderItemsData = hydratedItems
        .filter((item) => item.productId)
        .map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: Number(item.quantity || 1),
          price: parseStorefrontMoney(item.price),
          variantName: item.variantName || null,
        }));

      if (orderItemsData.length > 0) {
        await tx.orderItem.createMany({
          data: orderItemsData,
        });
      }

      return newOrder;
    });

    const customerName =
      [senderName, receiverName].find((value) => value && String(value).trim()) ||
      "Cliente DIFIORI";

    const emailData = {
      orderNumber: order.orderNumber,
      customerName,
      customerEmail: storefrontDetails.senderEmail,
      customerPhone: storefrontDetails.senderPhone || phone,
      billingContactName: receiverName || senderName || customerName,
      receiverPhone,
      billingPrincipalAddress: storefrontDetails.exactAddress || "No especificado",
      billingCity: sector || "",
      subtotal: parseMoney(total) - parseMoney(shippingCost) - couponDiscountAmount,
      tax: 0,
      shipping: parseMoney(shippingCost),
      total: parseMoney(total) - couponDiscountAmount,
      paymentStatus: "PENDING",
      paymentMethod,
      deliveryDateTime,
      cardMessage,
      observations,
      couponCode: appliedCouponCode,
      createdAt: new Date(order.createdAt).toLocaleDateString("es-EC", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      companyName: process.env.COMPANY_NAME || "DIFIORI",
      companyEmail: process.env.COMPANY_EMAIL || process.env.EMAIL_USER,
      companyPhone: process.env.COMPANY_PHONE || "",
      storeUrl,
      items: hydratedItems.map((item) => ({
        productName: item.productName || "Producto DIFIORI",
        variantName: item.variantName || null,
        quantity: Number(item.quantity || 1),
        price: parseStorefrontMoney(item.price),
        productImage: item.productImage || null,
      })),
    };

    try {
      await emailService.sendNewOrderAlert(emailData);
    } catch (emailError) {
      console.error("Store new order alert email error:", emailError);
    }

    if (storefrontDetails.senderEmail) {
      try {
        const activeCompany = await prisma.company.findFirst({
          where: { isActive: true },
          select: { name: true, email: true, phone: true },
        });

        const confirmationEmailData = {
          ...emailData,
          orderNumber: order.orderNumber,
          companyName: activeCompany?.name || process.env.COMPANY_NAME || "DIFIORI",
          companyEmail:
            activeCompany?.email || process.env.COMPANY_EMAIL || process.env.EMAIL_USER,
          companyPhone: activeCompany?.phone || process.env.COMPANY_PHONE || "",
        };

        await emailService.sendOrderConfirmation(confirmationEmailData);
      } catch (emailError) {
        console.error("Store order confirmation email error:", emailError);
      }
    }

    businessLog("ORDER", "CREATED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: paymentMethod || "UNKNOWN",
      paymentStatus: "PENDING",
      source: "TIENDA_WEB",
      senderName,
      senderEmail,
      receiverName,
      receiverPhone,
      productId: productId || null,
      productName: productName || null,
      quantity: Number(quantity || 1),
      productPrice: parseMoney(productPrice),
      durationMs: Date.now() - startedAt,
      total: parseMoney(total),
      shippingCost: parseMoney(shippingCost),
      couponCode: appliedCouponCode || null,
    });

    return res.status(201).json({
      status: "success",
      message: "Orden creada exitosamente",
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    });
  } catch (error) {
    businessError("ORDER", "CREATE_FAILED", error, {
      statusCode: error.statusCode,
      durationMs: Date.now() - startedAt,
      paymentMethod: req.body?.paymentMethod || null,
    });

    console.error("Store order error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al crear la orden",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.post("/:orderNumber/payment-proof", async (req, res) => {
  const startedAt = Date.now();
  try {
    const { orderNumber } = req.params;
    const { dataUrl, fileName } = req.body || {};

    if (!orderNumber) {
      return res.status(400).json({
        status: "error",
        message: "El numero de orden es obligatorio.",
      });
    }

    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      return res.status(400).json({
        status: "error",
        message: "Debes enviar una imagen valida del comprobante.",
      });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Orden no encontrada.",
      });
    }

    businessLog("PAYMENT", "PROOF_UPLOAD_STARTED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      fileName: fileName || "comprobante",
    });

    const { mimeType, buffer } = parseDataUrl(dataUrl);
    const safeOriginalName = sanitizeFileName(fileName || "comprobante");
    const extension =
      safeOriginalName.includes(".")
        ? ""
        : getExtensionFromMime(mimeType);
    const objectName = `payment-proofs/${order.orderNumber}-${Date.now()}-${safeOriginalName || "comprobante"}${extension}`;

    const uploadedProof = await uploadBuffer({
      objectName,
      buffer,
      contentType: mimeType,
    });
    const proofUrl = uploadedProof.url;

    try {
      await savePaymentProofInOrderNotes(order.id, proofUrl, fileName);
    } catch (notesError) {
      console.error("Payment proof orderNotes save warning:", notesError);
    }

    // Compatibilidad: si la base no tiene columnas de comprobante, no rompemos la subida.
    let updatedOrder;
    try {
      updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentProofImageUrl: proofUrl,
          paymentProofFileName: String(fileName || "comprobante"),
          paymentProofStatus: "UPLOADED",
          paymentProofUploadedAt: new Date(),
          paymentVerificationNotes: null,
        },
        select: {
          id: true,
          orderNumber: true,
          paymentProofImageUrl: true,
          paymentProofStatus: true,
          paymentProofUploadedAt: true,
        },
      });
    } catch (updateError) {
      console.error("Payment proof DB compatibility warning:", updateError);

      updatedOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        paymentProofImageUrl: proofUrl,
        paymentProofStatus: "UPLOADED",
        paymentProofUploadedAt: new Date(),
      };
    }

    businessLog("PAYMENT", "PROOF_UPLOADED", {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      paymentProofStatus: updatedOrder.paymentProofStatus,
      fileName: fileName || "comprobante",
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json({
      status: "success",
      message: "Comprobante subido correctamente.",
      data: updatedOrder,
    });
  } catch (error) {
    businessError("PAYMENT", "PROOF_UPLOAD_FAILED", error, {
      orderNumber: req.params?.orderNumber,
      durationMs: Date.now() - startedAt,
    });
    console.error("Payment proof upload error:", error);
    return res.status(500).json({
      status: "error",
      message: "No se pudo subir el comprobante.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
