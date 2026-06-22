const { nanoid } = require("nanoid");
const emailService = require("./emailService");
const { buildStorefrontOrderDetails } = require("../utils/storefrontOrderDetails");
const {
  parseStorefrontMoney,
  normalizeStorefrontItems,
  hydrateStorefrontItems,
} = require("../utils/storefrontCartItems");

const PAYPAL_REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}, timeoutMs = PAYPAL_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(`Tiempo de espera agotado de PayPal (${timeoutMs} ms).`);
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readPaypalJson(response) {
  const rawBody = await response.text();
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return { rawBody };
  }
}

function splitFullName(fullName = "") {
  const trimmed = String(fullName).trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || trimmed,
    lastName: parts.slice(1).join(" "),
  };
}

function formatAmount(value) {
  return Number(parseStorefrontMoney(value) || 0).toFixed(2);
}

function appendNote(existingValue = "", note) {
  const current = String(existingValue || "").trim();
  const nextNote = String(note || "").trim();
  if (!nextNote) return current;
  if (!current) return nextNote;
  if (current.includes(nextNote)) return current;
  return `${current} | ${nextNote}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function extractPaypalPayerEmail(orderNotes = "") {
  const match = String(orderNotes || "").match(/Correo PayPal indicado:\s*([^|]+)/i);
  return normalizeEmail(match?.[1] || "");
}

function getPaypalBaseUrl(environment) {
  return environment === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getActivePaypalCredentials(paymentSettings = {}) {
  const environment = paymentSettings.paypalEnvironment === "live" ? "live" : "sandbox";
  const prefix = environment === "live" ? "paypalLive" : "paypalSandbox";

  return {
    environment,
    clientId: paymentSettings[`${prefix}ClientId`] || "",
    clientSecret: paymentSettings[`${prefix}ClientSecret`] || "",
    merchantId: paymentSettings[`${prefix}MerchantId`] || "",
    webhookId: paymentSettings[`${prefix}WebhookId`] || "",
  };
}

async function getPublicCompanyPaymentSettings(prisma) {
  const company = await prisma.company.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      settings: true,
    },
  });

  if (!company) {
    const error = new Error("No se encontro una empresa activa para procesar pagos con PayPal.");
    error.statusCode = 404;
    throw error;
  }

  const settings =
    company.settings && typeof company.settings === "object" ? company.settings : {};
  const paymentSettings =
    settings.paymentSettings && typeof settings.paymentSettings === "object"
      ? settings.paymentSettings
      : {};

  return {
    company,
    paymentSettings,
  };
}

async function requestPaypalAccessToken({ environment, clientId, clientSecret }) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchWithTimeout(`${getPaypalBaseUrl(environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await readPaypalJson(response);

  if (!response.ok || !data.access_token) {
    const message =
      data.error_description ||
      data.message ||
      data.error ||
      "PayPal no acepto las credenciales configuradas.";
    const error = new Error(message);
    error.statusCode = response.status || 502;
    throw error;
  }

  return data.access_token;
}

function appendQueryParams(baseUrl, entries) {
  const url = new URL(String(baseUrl));
  Object.entries(entries || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
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
    const error = new Error(`El cupon requiere una compra minima de $${coupon.minAmount}`);
    error.statusCode = 400;
    throw error;
  }

  const couponDiscountAmount =
    coupon.type === "PERCENTAGE" ? subtotal * (coupon.value / 100) : coupon.value;

  return {
    couponDiscountAmount,
    couponId: coupon.id,
    appliedCouponCode: coupon.code,
  };
}

async function createPendingPaypalOrder(prisma, payload) {
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
    paymentLabel = "PayPal",
    paypalPayerEmail,
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
        orderNotes: [
          storefrontDetails.orderNotes,
          appliedCouponCode
            ? `Cupon: ${appliedCouponCode} (-$${couponDiscountAmount.toFixed(2)})`
            : "",
          paypalPayerEmail ? `Correo PayPal indicado: ${normalizeEmail(paypalPayerEmail)}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
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
    console.error("PayPal new order alert email error:", emailError);
  }

  return {
    order,
    finalTotal,
    clientTransactionId,
    orderNumber,
  };
}

async function createPaypalCheckoutOrder(prisma, payload) {
  const startedAt = Date.now();
  const serviceLog = (step, data = {}) => {
    console.log(`[PAYPAL_SERVICE][CREATE][${step}]`, JSON.stringify({
      durationMs: Date.now() - startedAt,
      ...data,
    }));
  };
  const { callbackUrl, cancellationUrl, paypalPayerEmail } = payload;
  const requiredPaypalPayerEmail = normalizeEmail(paypalPayerEmail);

  if (!callbackUrl || !cancellationUrl) {
    const error = new Error("Faltan las URLs de retorno de PayPal.");
    error.statusCode = 400;
    throw error;
  }

  // Validar formato del correo de PayPal si se proporcionó
  if (!requiredPaypalPayerEmail) {
    const error = new Error("Ingresa el correo de la cuenta PayPal que usara para pagar.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requiredPaypalPayerEmail)) {
    const error = new Error("El correo de PayPal debe tener un formato válido (ejemplo@dominio.com).");
    error.statusCode = 400;
    throw error;
  }

  serviceLog("settings:start");
  const { company, paymentSettings } = await getPublicCompanyPaymentSettings(prisma);
  const credentials = getActivePaypalCredentials(paymentSettings);
  serviceLog("settings:done", { environment: credentials.environment });

  const companySettings =
    company.settings && typeof company.settings === "object" ? company.settings : {};
  if (companySettings.acceptOrders === false) {
    const error = new Error("Tienda cerrada temporalmente");
    error.statusCode = 503;
    throw error;
  }

  if (!credentials.clientId || !credentials.clientSecret) {
    const error = new Error(
      `Completa Client ID y Client Secret de PayPal (${credentials.environment}) en el admin.`
    );
    error.statusCode = 400;
    throw error;
  }

  serviceLog("local-order:start");
  const pendingOrder = await createPendingPaypalOrder(prisma, payload);
  serviceLog("local-order:done", {
    orderNumber: pendingOrder.order.orderNumber,
    clientTransactionId: pendingOrder.clientTransactionId,
  });

  serviceLog("token:start");
  const accessToken = await requestPaypalAccessToken(credentials);
  serviceLog("token:done");
  const returnUrl = appendQueryParams(callbackUrl, {
    provider: "paypal",
    clientTransactionId: pendingOrder.clientTransactionId,
    orderNumber: pendingOrder.order.orderNumber,
  });
  const cancelUrl = appendQueryParams(cancellationUrl, {
    provider: "paypal",
    paypalStatus: "cancelled",
    clientTransactionId: pendingOrder.clientTransactionId,
    orderNumber: pendingOrder.order.orderNumber,
  });

  serviceLog("paypal-order:start");
  const response = await fetchWithTimeout(`${getPaypalBaseUrl(credentials.environment)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: company.name || "DIFIORI",
            locale: "es-EC",
            landing_page: "LOGIN",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
      purchase_units: [
        {
          reference_id: pendingOrder.order.orderNumber,
          custom_id: pendingOrder.clientTransactionId,
          description: `Pedido DIFIORI ${pendingOrder.order.orderNumber}`,
          amount: {
            currency_code: "USD",
            value: formatAmount(pendingOrder.finalTotal),
          },
        },
      ],
    }),
  });

  const data = await readPaypalJson(response);
  serviceLog("paypal-order:done", {
    ok: response.ok,
    status: response.status,
    paypalOrderId: data.id || null,
  });

  if (!response.ok || !data.id) {
    await prisma.order.update({
      where: { id: pendingOrder.order.id },
      data: {
        paymentStatus: "FAILED",
        orderNotes: appendNote(
          pendingOrder.order.orderNotes,
          "PayPal: error creando la orden remota."
        ),
      },
    });

    const error = new Error(
      data.message ||
        data.details?.[0]?.description ||
        "No se pudo crear la orden de PayPal."
    );
    error.statusCode = response.status || 502;
    throw error;
  }

  const approveUrl = Array.isArray(data.links)
    ? data.links.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href || ""
    : "";

  serviceLog("local-order:update-start");
  await prisma.order.update({
    where: { id: pendingOrder.order.id },
    data: {
      orderNotes: appendNote(
        pendingOrder.order.orderNotes,
        `PayPal Order ID: ${data.id}`
      ),
    },
  });
  serviceLog("local-order:update-done");

  return {
    order: pendingOrder.order,
    orderNumber: pendingOrder.order.orderNumber,
    clientTransactionId: pendingOrder.clientTransactionId,
    paypalOrderId: data.id,
    approveUrl,
    environment: credentials.environment,
  };
}

async function capturePaypalCheckoutOrder(prisma, payload) {
  const startedAt = Date.now();
  const serviceLog = (step, data = {}) => {
    console.log(`[PAYPAL_SERVICE][CAPTURE][${step}]`, JSON.stringify({
      durationMs: Date.now() - startedAt,
      ...data,
    }));
  };
  const {
    paypalOrderId,
    token,
    clientTransactionId,
    cancelled = false,
  } = payload || {};
  const resolvedPaypalOrderId = String(paypalOrderId || token || "").trim();
  const resolvedClientTransactionId = String(clientTransactionId || "").trim();

  if (!resolvedClientTransactionId) {
    const error = new Error("Falta el identificador interno de la orden.");
    error.statusCode = 400;
    throw error;
  }

  serviceLog("local-order:find-start", { clientTransactionId: resolvedClientTransactionId });
  const order = await prisma.order.findUnique({
    where: { clientTransactionId: resolvedClientTransactionId },
  });
  serviceLog("local-order:find-done", {
    found: Boolean(order),
    paymentStatus: order?.paymentStatus || null,
  });

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

  if (cancelled || !resolvedPaypalOrderId) {
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "CANCELLED",
        orderNotes: appendNote(
          order.orderNotes,
          resolvedPaypalOrderId
            ? `PayPal Order ID: ${resolvedPaypalOrderId}`
            : "PayPal: pago cancelado por el cliente."
        ),
      },
    });

    return {
      order: updatedOrder,
      paymentStatus: "CANCELLED",
      approved: false,
      alreadyProcessed: false,
    };
  }

  serviceLog("settings:start");
  const { paymentSettings } = await getPublicCompanyPaymentSettings(prisma);
  const credentials = getActivePaypalCredentials(paymentSettings);
  serviceLog("settings:done", { environment: credentials.environment });

  if (!credentials.clientId || !credentials.clientSecret) {
    const error = new Error("Las credenciales activas de PayPal no estan configuradas.");
    error.statusCode = 400;
    throw error;
  }

  serviceLog("token:start");
  const accessToken = await requestPaypalAccessToken(credentials);
  serviceLog("token:done");

  serviceLog("capture:start", { paypalOrderId: resolvedPaypalOrderId });
  const response = await fetchWithTimeout(
    `${getPaypalBaseUrl(credentials.environment)}/v2/checkout/orders/${encodeURIComponent(
      resolvedPaypalOrderId
    )}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({}),
    }
  );

  const data = await readPaypalJson(response);
  serviceLog("capture:done", {
    ok: response.ok,
    status: response.status,
    paypalStatus: data?.status || null,
  });

  if (!response.ok) {
    const error = new Error(
      data.message ||
        data.details?.[0]?.description ||
        "No se pudo capturar el pago de PayPal."
    );
    error.statusCode = response.status || 502;
    throw error;
  }

  const purchaseUnit = Array.isArray(data.purchase_units) ? data.purchase_units[0] || {} : {};
  const capture = Array.isArray(purchaseUnit?.payments?.captures)
    ? purchaseUnit.payments.captures[0] || {}
    : {};
  const paypalStatus = String(capture.status || data.status || "").toUpperCase();
  const approved = paypalStatus === "COMPLETED";
  const expectedPayerEmail = extractPaypalPayerEmail(order.orderNotes);
  const actualPayerEmail = normalizeEmail(
    data?.payment_source?.paypal?.email_address || data?.payer?.email_address
  );
  const capturedAmount = Number(
    capture?.amount?.value || purchaseUnit?.amount?.value || 0
  );

  if (approved) {
    const expectedAmount = Number(order.total || 0);
    const amountMismatch = Math.abs(capturedAmount - expectedAmount) > 0.02;
    if (amountMismatch) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "FAILED",
          orderNotes: appendNote(
            appendNote(order.orderNotes, `PayPal Order ID: ${resolvedPaypalOrderId}`),
            `PayPal: monto inconsistente (${capturedAmount} vs ${expectedAmount}).`
          ),
        },
      });

      const error = new Error("Error de integridad en el monto del pago de PayPal.");
      error.statusCode = 400;
      throw error;
    }

    if (expectedPayerEmail && expectedPayerEmail !== actualPayerEmail) {
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          paymentVerificationNotes: `PayPal: correo no coincide. Esperado: ${expectedPayerEmail}. Pagador real: ${actualPayerEmail || "no disponible"}.`,
          orderNotes: appendNote(
            appendNote(order.orderNotes, `PayPal Order ID: ${resolvedPaypalOrderId}`),
            `PayPal: correo no coincide (${expectedPayerEmail} vs ${actualPayerEmail || "no disponible"}).`
          ),
        },
      });

      return {
        order: updatedOrder,
        paymentStatus: "PAID",
        approved: true,
        alreadyProcessed: false,
        paypalOrderId: resolvedPaypalOrderId,
        captureId: capture?.id || null,
        payerId: data?.payer?.payer_id || data?.payment_source?.paypal?.account_id || null,
        payerEmail: actualPayerEmail,
        expectedPayerEmail,
        emailMismatch: true,
      };
    }
  }

  const newPaymentStatus = approved ? "PAID" : "FAILED";
  const payerId = data?.payer?.payer_id || data?.payment_source?.paypal?.account_id || null;
  const captureId = capture?.id || null;
  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: newPaymentStatus,
      paidAt: approved ? new Date() : null,
      orderNotes: [
        appendNote(order.orderNotes, `PayPal Order ID: ${resolvedPaypalOrderId}`),
        captureId ? `PayPal Capture ID: ${captureId}` : "",
        payerId ? `PayPal Payer ID: ${payerId}` : "",
        actualPayerEmail ? `PayPal Payer Email: ${actualPayerEmail}` : "",
        paypalStatus ? `PayPal Status: ${paypalStatus}` : "",
      ]
        .filter(Boolean)
        .reduce((acc, note) => appendNote(acc, note), ""),
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
    paypalOrderId: resolvedPaypalOrderId,
    captureId,
    payerId,
    payerEmail: actualPayerEmail,
    expectedPayerEmail,
    emailMismatch: false,
  };
}

module.exports = {
  createPaypalCheckoutOrder,
  capturePaypalCheckoutOrder,
};
