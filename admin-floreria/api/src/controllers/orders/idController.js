const { Prisma } = require("@prisma/client");
const { db: prisma } = require("../../lib/prisma");
const { orderEvents } = require("../../events/orderEvents");
const minioClient = require("../../lib/s3Config");
const { businessLog, businessError } = require("../../utils/logger");

const PROOFS_BUCKET_NAME = process.env.MINIO_BUCKET || "difiori";
const PROOFS_PUBLIC_URL = String(
  process.env.MINIO_PUBLIC_URL || `http://66.94.98.69:9000/${PROOFS_BUCKET_NAME}`
)
  .trim()
  .replace(/\/+$/g, "");

const orderSelect = {
  id: true,
  orderNumber: true,
  sequentialNumber: true,
  customerName: true,
  customerLastName: true,
  customerProvince: true,
  billingPrincipalAddress: true,
  billingSecondAddress: true,
  customerReference: true,
  subtotal: true,
  tax: true,
  shipping: true,
  total: true,
  paymentStatus: true,
  status: true,
  deliveryNotes: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  updatedBy: true,
  source: true,
  sourceIp: true,
  sourceUserAgent: true,
  verifiedWebhook: true,
  Courier: true,
  billingContactName: true,
  billingCity: true,
  customerEmail: true,
  orderNotes: true,
  customerPhone: true,
  total_discount_amount: true,
  product_discounted_amount: true,
  code_discounted_amount: true,
  coupon_discounted_amount: true,
  discount_coupon_percent: true,
  discount_code_percent: true,
  discount_coupon_id: true,
  discount_code_id: true,
  cashOnDelivery: true,
  clientTransactionId: true,
  couponDiscountCode: true,
  payPhoneAuthCode: true,
  payPhoneTransactionId: true,
  orderItems: {
    select: {
      id: true,
      quantity: true,
      price: true,
      productId: true,
      orderId: true,
      variantName: true,
      discounts_percents: true,
      discounts_ids: true,
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          image: true,
        },
      },
    },
  },
};

const PAYMENT_PROOF_COLUMNS = [
  "paymentProofImageUrl",
  "paymentProofFileName",
  "paymentProofStatus",
  "paymentProofUploadedAt",
  "paymentVerifiedAt",
  "paymentVerifiedBy",
  "paymentVerificationNotes",
];

let cachedPaymentProofColumns = null;

function normalizeNoteLabel(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractPaymentProofFromNotes(notes) {
  if (!notes) {
    return {
      paymentProofImageUrl: null,
      paymentProofFileName: null,
    };
  }

  const details = {};

  String(notes)
    .split("|")
    .forEach((part) => {
      const [rawLabel, ...valueParts] = part.split(":");
      const value = valueParts.join(":").trim();
      if (!rawLabel || !value) return;

      const label = normalizeNoteLabel(rawLabel);
      if (label === "comprobante url") {
        details.paymentProofImageUrl = value;
      }
      if (label === "comprobante archivo") {
        details.paymentProofFileName = value;
      }
    });

  return {
    paymentProofImageUrl: details.paymentProofImageUrl || null,
    paymentProofFileName: details.paymentProofFileName || null,
  };
}

function getPaymentProofProxyUrl(orderId, rawUrl) {
  if (!orderId || !rawUrl) return null;
  return `/api/orders/${orderId}/payment-proof/image`;
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function parseMinioObjectFromUrl(fileUrl) {
  if (!fileUrl) return null;

  try {
    const parsedUrl = new URL(fileUrl);
    const publicUrl = new URL(PROOFS_PUBLIC_URL);
    if (parsedUrl.origin !== publicUrl.origin) {
      return null;
    }

    const pathnameParts = parsedUrl.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const publicPathParts = publicUrl.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    if (pathnameParts.length <= publicPathParts.length) return null;
    const matchesPrefix = publicPathParts.every(
      (segment, index) => pathnameParts[index] === segment
    );

    if (!matchesPrefix) return null;

    return {
      bucketName: PROOFS_BUCKET_NAME,
      objectName: pathnameParts.slice(publicPathParts.length).join("/"),
    };
  } catch (error) {
    return null;
  }
}

function buildMinioPublicUrl(objectName) {
  const objectPath = String(objectName || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${PROOFS_PUBLIC_URL}/${objectPath}`;
}

function findLatestPaymentProofInMinio(orderNumber) {
  return new Promise((resolve) => {
    if (!orderNumber) {
      resolve(null);
      return;
    }

    const prefix = `payment-proofs/${orderNumber}-`;
    const objectsStream = minioClient.listObjectsV2(
      PROOFS_BUCKET_NAME,
      prefix,
      true
    );
    let latestObject = null;

    objectsStream.on("data", (object) => {
      if (!object?.name) return;

      if (
        !latestObject ||
        new Date(object.lastModified || 0) >
          new Date(latestObject.lastModified || 0)
      ) {
        latestObject = object;
      }
    });

    objectsStream.on("error", (error) => {
      console.error("Payment proof MinIO lookup error:", error);
      resolve(null);
    });

    objectsStream.on("end", () => {
      resolve(latestObject ? buildMinioPublicUrl(latestObject.name) : null);
    });
  });
}

async function getExistingPaymentProofColumns() {
  if (cachedPaymentProofColumns) return cachedPaymentProofColumns;

  try {
    const rows = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name IN (${Prisma.join(PAYMENT_PROOF_COLUMNS)})
    `;

    cachedPaymentProofColumns = new Set(rows.map((row) => row.column_name));
  } catch (error) {
    console.error("Payment proof column detection error:", error);
    cachedPaymentProofColumns = new Set();
  }

  return cachedPaymentProofColumns;
}

async function getPaymentProofFields(orderId) {
  const existingColumns = await getExistingPaymentProofColumns();
  if (!existingColumns.has("paymentProofImageUrl")) {
    return {
      paymentProofImageUrl: null,
      paymentProofFileName: null,
      paymentProofStatus: null,
      paymentProofUploadedAt: null,
      paymentVerifiedAt: null,
      paymentVerifiedBy: null,
      paymentVerificationNotes: null,
    };
  }

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        "paymentProofImageUrl",
        "paymentProofFileName",
        "paymentProofStatus",
        "paymentProofUploadedAt",
        "paymentVerifiedAt",
        "paymentVerifiedBy",
        "paymentVerificationNotes"
      FROM "public"."orders"
      WHERE "id" = ${orderId}
      LIMIT 1
    `;

    return (
      rows[0] || {
        paymentProofImageUrl: null,
        paymentProofFileName: null,
        paymentProofStatus: null,
        paymentProofUploadedAt: null,
        paymentVerifiedAt: null,
        paymentVerifiedBy: null,
        paymentVerificationNotes: null,
      }
    );
  } catch (error) {
    console.error("Payment proof fetch error:", error);
    return {
      paymentProofImageUrl: null,
      paymentProofFileName: null,
      paymentProofStatus: null,
      paymentProofUploadedAt: null,
      paymentVerifiedAt: null,
      paymentVerifiedBy: null,
      paymentVerificationNotes: null,
    };
  }
}

function roundMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function serializeOrder(order, paymentProofFields = {}) {
  const fallbackProofData = extractPaymentProofFromNotes(order.orderNotes);
  const rawPaymentProofImageUrl =
    paymentProofFields.paymentProofImageUrl || fallbackProofData.paymentProofImageUrl || null;
  const rawPaymentProofFileName =
    paymentProofFields.paymentProofFileName || fallbackProofData.paymentProofFileName || null;
  const totalAmount = Number(order.total || 0);
  const shipping = Number(order.shipping || 0);
  const subtotal = Number(order.subtotal || 0);
  const tax = Number(order.tax || 0);
  const pendingAmount = shipping > 0 ? Math.max(0, subtotal + tax - shipping) : 0;
  const estimatedDiscountAmount = roundMoney(order.total_discount_amount);

  return {
    ...order,
    description: null,
    notes: null,
    paymentProofImageUrl: rawPaymentProofImageUrl,
    paymentProofRawUrl: rawPaymentProofImageUrl,
    paymentProofProxyUrl: getPaymentProofProxyUrl(order.id, rawPaymentProofImageUrl),
    paymentProofFileName: rawPaymentProofFileName,
    paymentProofStatus: paymentProofFields.paymentProofStatus || null,
    paymentProofUploadedAt: paymentProofFields.paymentProofUploadedAt || null,
    paymentVerifiedAt: paymentProofFields.paymentVerifiedAt || null,
    paymentVerifiedBy: paymentProofFields.paymentVerifiedBy || null,
    paymentVerificationNotes:
      paymentProofFields.paymentVerificationNotes || null,
    totalAmount,
    estimatedDiscountAmount,
    pendingAmount,
  };
}

exports.getPaymentProofImage = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        orderNotes: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Orden no encontrada",
      });
    }

    const paymentProofFields = await getPaymentProofFields(order.id);
    const fallbackProofData = extractPaymentProofFromNotes(order.orderNotes);
    const rawPaymentProofImageUrl =
      paymentProofFields.paymentProofImageUrl || fallbackProofData.paymentProofImageUrl || null;

    if (!rawPaymentProofImageUrl) {
      return res.status(404).json({
        status: "error",
        message: "La orden no tiene comprobante guardado.",
      });
    }

    const minioFile = parseMinioObjectFromUrl(rawPaymentProofImageUrl);
    if (!minioFile) {
      if (isAbsoluteHttpUrl(rawPaymentProofImageUrl)) {
        return res.redirect(rawPaymentProofImageUrl);
      }

      return res.status(400).json({
        status: "error",
        message: "La URL del comprobante no es valida.",
      });
    }

    const stat = await minioClient.statObject(
      minioFile.bucketName,
      minioFile.objectName
    );
    const objectStream = await minioClient.getObject(
      minioFile.bucketName,
      minioFile.objectName
    );

    const contentType =
      stat?.metaData?.["content-type"] ||
      stat?.metaData?.["Content-Type"] ||
      "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300");
    objectStream.on("error", (streamError) => {
      console.error("Payment proof stream error:", streamError);
      if (!res.headersSent) {
        res.status(500).end("Error al leer el comprobante");
      } else {
        res.end();
      }
    });

    return objectStream.pipe(res);
  } catch (error) {
    console.error("Get payment proof image error:", error);
    return res.status(500).json({
      status: "error",
      message: "No se pudo obtener el comprobante.",
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: orderSelect,
    });

    if (!order) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const paymentProofFields = await getPaymentProofFields(order.id);
    const fallbackProofData = extractPaymentProofFromNotes(order.orderNotes);
    const minioProofUrl =
      paymentProofFields.paymentProofImageUrl ||
      fallbackProofData.paymentProofImageUrl
        ? null
        : await findLatestPaymentProofInMinio(order.orderNumber);

    return res.status(200).json({
      status: "success",
      message: "Orden obtenida",
      data: serializeOrder(order, {
        ...paymentProofFields,
        paymentProofImageUrl:
          paymentProofFields.paymentProofImageUrl ||
          fallbackProofData.paymentProofImageUrl ||
          minioProofUrl,
      }),
    });
  } catch (error) {
    console.error("Get order by id error:", error);
    return res.status(500).json({ error: "Error al obtener orden" });
  }
};

exports.updateOrderById = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { id } = req.params;
    const data = req.body;
    const previousOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
      },
    });

    const order = await prisma.order.update({
      where: { id },
      data,
      select: orderSelect,
    });
    const paymentProofFields = await getPaymentProofFields(order.id);
    businessLog("ORDER", "UPDATED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      statusBefore: previousOrder?.status,
      statusAfter: order.status,
      paymentStatusBefore: previousOrder?.paymentStatus,
      paymentStatusAfter: order.paymentStatus,
      updatedFields: Object.keys(data || {}),
      durationMs: Date.now() - startedAt,
    });
    return res.status(200).json({
      order: serializeOrder(order, paymentProofFields),
    });
  } catch (error) {
    businessError("ORDER", "UPDATE_FAILED", error, {
      orderId: req.params?.id,
      durationMs: Date.now() - startedAt,
    });
    console.error("Update order by id error:", error);
    return res.status(500).json({ error: "Error al actualizar orden" });
  }
};

exports.updateStateOrderById = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        status: "error",
        message: "Status es requerido",
      });
    }

    const validStatuses = [
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Status invalido",
      });
    }

    const previousOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
        total: true,
      },
    });

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      select: orderSelect,
    });

    orderEvents.emit("order.status.updated", {
      id: order.id,
      status: order.status,
      order: order.orderNumber,
      customerName: order.customerName,
      updatedAt: new Date().toISOString(),
    });

    const paymentProofFields = await getPaymentProofFields(order.id);

    businessLog("ORDER", "STATUS_CHANGED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      from: previousOrder?.status,
      to: order.status,
      paymentStatus: order.paymentStatus,
      total: Number(order.total || 0),
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json({
      status: "success",
      message: "Estado actualizado correctamente",
      data: { order: serializeOrder(order, paymentProofFields) },
    });
  } catch (error) {
    businessError("ORDER", "STATUS_CHANGE_FAILED", error, {
      orderId: req.params?.id,
      requestedStatus: req.body?.status,
      durationMs: Date.now() - startedAt,
    });
    console.error("Update order status error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al actualizar estado de la orden",
      details: error.message,
    });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const validStatuses = ["PENDING", "PAID", "FAILED", "CANCELLED"];
    if (!paymentStatus || !validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ status: "error", message: "paymentStatus invalido." });
    }

    const previousOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
        total: true,
      },
    });

    const order = await prisma.order.update({
      where: { id },
      data: {
        paymentStatus,
        paidAt: paymentStatus === "PAID" ? new Date() : undefined,
      },
      select: orderSelect,
    });

    const paymentProofFields = await getPaymentProofFields(order.id);

    businessLog("PAYMENT", "STATUS_CHANGED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      orderStatus: order.status,
      from: previousOrder?.paymentStatus,
      to: order.paymentStatus,
      total: Number(order.total || 0),
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json({
      status: "success",
      message: "Estado de pago actualizado",
      data: { order: serializeOrder(order, paymentProofFields) },
    });
  } catch (error) {
    businessError("PAYMENT", "STATUS_CHANGE_FAILED", error, {
      orderId: req.params?.id,
      requestedPaymentStatus: req.body?.paymentStatus,
      durationMs: Date.now() - startedAt,
    });
    console.error("Update payment status error:", error);
    return res.status(500).json({ status: "error", message: "Error al actualizar estado de pago." });
  }
};

exports.updatePaymentProof = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { id } = req.params;
    const { paymentProofStatus, paymentVerificationNotes } = req.body;
    const existingColumns = await getExistingPaymentProofColumns();

    if (!existingColumns.has("paymentProofStatus")) {
      return res.status(501).json({
        status: "error",
        message: "La base actual no soporta campos de comprobante de pago todavia.",
      });
    }

    const validStatuses = ["PENDING", "UPLOADED", "VERIFIED", "REJECTED"];
    if (!paymentProofStatus || !validStatuses.includes(paymentProofStatus)) {
      return res.status(400).json({
        status: "error",
        message: "paymentProofStatus invalido.",
      });
    }

    const notesValue =
      typeof paymentVerificationNotes === "string"
        ? paymentVerificationNotes
        : null;
    const verifiedAtValue =
      paymentProofStatus === "VERIFIED" ? new Date() : null;

    const assignments = [];
    const values = [];

    if (existingColumns.has("paymentProofStatus")) {
      assignments.push(`"paymentProofStatus" = $${values.length + 1}`);
      values.push(paymentProofStatus);
    }

    if (existingColumns.has("paymentVerificationNotes")) {
      assignments.push(`"paymentVerificationNotes" = $${values.length + 1}`);
      values.push(notesValue);
    }

    if (existingColumns.has("paymentVerifiedAt")) {
      assignments.push(`"paymentVerifiedAt" = $${values.length + 1}`);
      values.push(verifiedAtValue);
    }

    if (!assignments.length) {
      return res.status(501).json({
        status: "error",
        message:
          "La base actual no tiene columnas disponibles para actualizar el comprobante.",
      });
    }

    values.push(id);

    await prisma.$executeRawUnsafe(
      `
        UPDATE "public"."orders"
        SET ${assignments.join(", ")}
        WHERE "id" = $${values.length}
      `,
      ...values
    );

    const order = await prisma.order.findUnique({
      where: { id },
      select: orderSelect,
    });

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Orden no encontrada",
      });
    }

    const paymentProofFields = await getPaymentProofFields(order.id);

    businessLog("PAYMENT", "PROOF_STATUS_CHANGED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      paymentStatus: order.paymentStatus,
      paymentProofStatus,
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json({
      status: "success",
      message: "Comprobante actualizado correctamente.",
      data: { order: serializeOrder(order, paymentProofFields) },
    });
  } catch (error) {
    businessError("PAYMENT", "PROOF_STATUS_CHANGE_FAILED", error, {
      orderId: req.params?.id,
      requestedPaymentProofStatus: req.body?.paymentProofStatus,
      durationMs: Date.now() - startedAt,
    });
    console.error("Update payment proof error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al actualizar el comprobante.",
    });
  }
};

exports.deleteOrderById = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { id } = req.params;
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
        total: true,
      },
    });
    await prisma.order.delete({
      where: { id },
    });
    businessLog("ORDER", "DELETED", {
      orderId: existingOrder?.id || id,
      orderNumber: existingOrder?.orderNumber,
      customerName: existingOrder?.customerName,
      customerEmail: existingOrder?.customerEmail,
      customerPhone: existingOrder?.customerPhone,
      status: existingOrder?.status,
      paymentStatus: existingOrder?.paymentStatus,
      total: Number(existingOrder?.total || 0),
      durationMs: Date.now() - startedAt,
    });
    return res.status(200).json({ message: "Orden eliminada" });
  } catch (error) {
    businessError("ORDER", "DELETE_FAILED", error, {
      orderId: req.params?.id,
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({ error: "Error al eliminar orden" });
  }
};
