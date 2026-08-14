const { nanoid } = require("nanoid");
const emailService = require("./emailService");
const { buildStorefrontOrderDetails } = require("../utils/storefrontOrderDetails");
const {
  parseStorefrontMoney,
  normalizeStorefrontItems,
  hydrateStorefrontItems,
} = require("../utils/storefrontCartItems");

function splitFullName(fullName = "") {
  const trimmed = String(fullName).trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || trimmed,
    lastName: parts.slice(1).join(" "),
  };
}

async function resolveCoupon(prisma, { couponCode, total, shippingCost }) {
  if (!couponCode) {
    return { couponDiscountAmount: 0, couponId: null, appliedCouponCode: null };
  }

  const now = new Date();
  const coupon = await prisma.coupons.findFirst({
    where: {
      code: String(couponCode).toUpperCase(),
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
  });

  if (!coupon) {
    return { couponDiscountAmount: 0, couponId: null, appliedCouponCode: null };
  }

  const subtotal = Number(total) - Number(shippingCost || 0);
  if (coupon.minAmount && subtotal < coupon.minAmount) {
    const error = new Error(`El cupón requiere una compra mínima de $${coupon.minAmount}`);
    error.statusCode = 400;
    throw error;
  }

  const couponDiscountAmount = coupon.type === "PERCENTAGE"
    ? subtotal * (coupon.value / 100)
    : coupon.value;

  return {
    couponDiscountAmount,
    couponId: coupon.id,
    appliedCouponCode: coupon.code,
  };
}

async function createPendingPayphoneOrder(prisma, payload) {
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
    total,
    couponCode,
    storeUrl,
    paymentLabel = "Tarjeta (PayPhone Box)",
  } = payload;

  if (!receiverName || !senderName || !phone || !total) {
    const error = new Error("Faltan datos obligatorios.");
    error.statusCode = 400;
    throw error;
  }

  const { couponDiscountAmount, couponId, appliedCouponCode } = await resolveCoupon(prisma, {
    couponCode,
    total,
    shippingCost,
  });

  const finalTotal = Number(total) - couponDiscountAmount;
  const amountInCents = Math.round(finalTotal * 100);
  const orderNumber = `DIFIORI-${Date.now()}`;
  const clientTransactionId = nanoid(16);
  const senderParts = splitFullName(senderName);
  const normalizedItems = normalizeStorefrontItems(rawItems, {
    productId,
    productName,
    productPrice,
    quantity,
  });
  const hydratedItems = await hydrateStorefrontItems(prisma, normalizedItems);
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
    paymentLabel,
  });

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        clientTransactionId,
        customerName: senderParts.firstName,
        customerLastName: senderParts.lastName,
        customerEmail: storefrontDetails.senderEmail,
        customerPhone: storefrontDetails.senderPhone,
        billingContactName: storefrontDetails.receiverName,
        billingPrincipalAddress: storefrontDetails.exactAddress || "No especificado",
        billingSecondAddress: null,
        customerReference: storefrontDetails.observations,
        subtotal: Number(total) - Number(shippingCost || 0) - couponDiscountAmount,
        tax: 0,
        shipping: Number(shippingCost || 0),
        total: finalTotal,
        paymentStatus: "PENDING",
        status: "PENDING",
        deliveryNotes: storefrontDetails.cardMessage,
        source: "TIENDA_WEB",
        discount_coupon_id: couponId,
        couponDiscountCode: appliedCouponCode,
        coupon_discounted_amount: couponDiscountAmount,
        total_discount_amount: couponDiscountAmount,
        orderNotes: `${storefrontDetails.orderNotes}${appliedCouponCode ? ` | Cupón: ${appliedCouponCode} (-$${couponDiscountAmount.toFixed(2)})` : ""}`,
      },
    });

    const orderItemsData = hydratedItems
      .filter((item) => item.productId)
      .map((item) => ({
        orderId: newOrder.id,
        productId: item.productId,
        quantity: Number(item.quantity),
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

  try {
    await emailService.sendNewOrderAlert({
      orderNumber: order.orderNumber,
      customerName: senderName,
      customerEmail: storefrontDetails.senderEmail,
      customerPhone: storefrontDetails.senderPhone || phone,
      billingContactName: storefrontDetails.receiverName,
      receiverPhone,
      billingPrincipalAddress: storefrontDetails.exactAddress || "No especificado",
      billingCity: sector || "",
      subtotal: Number(total) - Number(shippingCost || 0) - couponDiscountAmount,
      tax: 0,
      shipping: Number(shippingCost || 0),
      total: finalTotal,
      paymentStatus: "PENDING",
      paymentMethod: paymentLabel,
      deliveryDateTime,
      cardMessage,
      observations,
      couponCode: appliedCouponCode,
      storeUrl,
      items: hydratedItems.map((item) => ({
        productName: item.productName || "Producto DIFIORI",
        quantity: Number(item.quantity || 1),
        price: parseStorefrontMoney(item.price),
        productImage: item.productImage || null,
        variantName: item.variantName || null,
      })),
    });
  } catch (emailError) {
    console.error("PayPhone new order alert email error:", emailError);
  }

  return {
    order,
    amountInCents,
    finalTotal,
    clientTransactionId,
    orderNumber,
  };
}

async function finalizePayphoneOrder(prisma, payload) {
  const {
    clientTransactionId,
    payphoneTransactionId,
    transactionStatus,
    amount,
    authorizationCode,
  } = payload;

  if (!clientTransactionId) {
    const error = new Error("Faltan datos de confirmación.");
    error.statusCode = 400;
    throw error;
  }

  const order = await prisma.order.findUnique({ where: { clientTransactionId } });
  if (!order) {
    const error = new Error("Orden no encontrada.");
    error.statusCode = 404;
    throw error;
  }

  if (["PAID", "FAILED", "CANCELLED"].includes(order.paymentStatus)) {
    return {
      order,
      paymentStatus: order.paymentStatus,
      approved: order.paymentStatus === "PAID",
      alreadyProcessed: true,
    };
  }

  const normalizedTransactionStatus = String(transactionStatus || "").trim().toLowerCase();
  const isCancelled = ["cancelled", "canceled"].includes(normalizedTransactionStatus);

  if (!payphoneTransactionId || isCancelled) {
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "CANCELLED",
        payPhoneTransactionId: payphoneTransactionId ? String(payphoneTransactionId) : null,
      },
    });

    return {
      order: updatedOrder,
      paymentStatus: "CANCELLED",
      approved: false,
      alreadyProcessed: false,
    };
  }

  const approved = normalizedTransactionStatus === "approved";
  const normalizedAmount = Number(amount);
  if (approved && Number.isFinite(normalizedAmount)) {
    const expectedAmountCents = Math.round(Number(order.total) * 100);
    const amountMismatch = Math.abs(normalizedAmount - expectedAmountCents) > 2;
    if (amountMismatch) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "FAILED",
          payPhoneTransactionId: String(payphoneTransactionId),
        },
      });

      const error = new Error("Error de integridad en el pago.");
      error.statusCode = 400;
      throw error;
    }
  }

  const newPaymentStatus = approved ? "PAID" : "FAILED";
  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: newPaymentStatus,
      payPhoneTransactionId: String(payphoneTransactionId),
      payPhoneAuthCode: authorizationCode || null,
      paidAt: approved ? new Date() : null,
    },
  });

  if (approved && order.discount_coupon_id) {
    await prisma.coupons.update({
      where: { id: order.discount_coupon_id },
      data: { usesTotal: { increment: 1 } },
    });
  }

  return {
    order: updatedOrder,
    paymentStatus: newPaymentStatus,
    approved,
    alreadyProcessed: false,
  };
}

module.exports = {
  createPendingPayphoneOrder,
  finalizePayphoneOrder,
};
