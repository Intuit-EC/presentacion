const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const juice = require("juice");
const fs = require("fs").promises;
const { existsSync } = require("fs");
const path = require("path");
const { getDefaultFrom, getSmtpConfig } = require("../utils/smtpConfig");
const { resolvePublicMediaUrl } = require("../utils/publicMediaUrl");
const EMAIL_LOGO_PATH = path.resolve(
  __dirname,
  "../../../client/public/difiori.png"
);
const EMAIL_LOGO_ATTACHMENT = existsSync(EMAIL_LOGO_PATH)
  ? [
      {
        filename: "difiori.png",
        path: EMAIL_LOGO_PATH,
        cid: "logo",
      },
    ]
  : [];
const EMAIL_LOGO_HTML_SMALL = EMAIL_LOGO_ATTACHMENT.length
  ? '<img src="cid:logo" alt="DIFIORI" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:18px;" />'
  : "";
const EMAIL_LOGO_HTML_LARGE = EMAIL_LOGO_ATTACHMENT.length
  ? '<img src="cid:logo" alt="DIFIORI" width="84" height="84" style="display:block;width:84px;height:84px;border-radius:22px;" />'
  : "";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function resolveImageUrl(imagePath, baseUrl) {
  const rawValue = String(imagePath || "").trim();
  if (!rawValue) return "";
  if (/^https?:\/\//i.test(rawValue)) return rawValue;
  if (!baseUrl) return "";

  try {
    return new URL(rawValue.startsWith("/") ? rawValue : `/${rawValue}`, baseUrl).toString();
  } catch {
    return "";
  }
}

function sanitizeCidFragment(value, fallback = "item") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

function resolveLocalPublicImagePath(imagePath) {
  const value = String(imagePath || "").trim();
  if (!value || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/")) {
    return "";
  }

  const normalizedPath = decodeURIComponent(value.startsWith("/") ? value.slice(1) : value);
  const candidatePath = path.resolve(__dirname, "../../../client/public", normalizedPath);
  return existsSync(candidatePath) ? candidatePath : "";
}

function buildEmailImageSource(imagePath, attachments, cidPrefix, fallbackBaseUrl) {
  const localPath = resolveLocalPublicImagePath(imagePath);
  if (localPath) {
    const cid = `${cidPrefix}-${sanitizeCidFragment(path.basename(localPath), "image")}@difiori`;
    attachments.push({
      filename: path.basename(localPath),
      path: localPath,
      cid,
    });
    return `cid:${cid}`;
  }

  return resolvePublicMediaUrl(imagePath) || resolveImageUrl(imagePath, fallbackBaseUrl);
}

function normalizeEmailItems(items, storeUrl) {
  const attachments = [];
  const normalizedItems = (Array.isArray(items) ? items : []).map((item, index) => {
    const name = item.productName || item.name || "Producto DIFIORI";
    const quantity = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const lineTotal = quantity * price;

    return {
      name,
      quantity,
      price,
      lineTotal,
      variantName: item.variantName || "",
      imageUrl: buildEmailImageSource(
        item.productImage || item.image,
        attachments,
        `order-item-${index + 1}`,
        storeUrl
      ),
    };
  });

  return {
    items: normalizedItems,
    attachments,
  };
}

function renderItemsTable(items) {
  if (items.length === 0) {
    return `
      <tr>
        <td style="padding:18px 0;color:#5e4b70;font-size:16px;">Sin productos detallados</td>
      </tr>
    `;
  }

  return items
    .map((item) => `
      <tr>
        <td style="padding:18px 0;border-bottom:1px solid #f0e7f6;vertical-align:top;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #f0e7f6;border-radius:20px;background:#fffafc;">
            <tr>
              ${
                item.imageUrl
                  ? `<td width="132" style="padding:16px 0 16px 16px;vertical-align:top;">
                      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" width="112" height="112" style="display:block;width:112px;height:112px;object-fit:cover;border-radius:18px;border:1px solid #eadcf4;background:#ffffff;" />
                    </td>`
                  : ""
              }
              <td style="padding:16px 8px 16px 0;vertical-align:top;">
                <div style="font-size:24px;line-height:1.3;font-weight:800;color:#3d2852;">${escapeHtml(item.name)}</div>
                ${
                  item.variantName
                    ? `<div style="margin-top:6px;font-size:14px;color:#7c6a8d;">${escapeHtml(item.variantName)}</div>`
                    : ""
                }
                <div style="margin-top:12px;font-size:16px;color:#5e4b70;">Cantidad: ${item.quantity}</div>
                <div style="margin-top:4px;font-size:16px;color:#5e4b70;">Precio unitario: $${formatMoney(item.price)}</div>
              </td>
              <td style="padding:16px 16px 16px 8px;vertical-align:top;text-align:right;font-size:24px;font-weight:800;color:#3d2852;white-space:nowrap;">
                $${formatMoney(item.lineTotal)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `)
    .join("");
}

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    this.transporter = nodemailer.createTransport(getSmtpConfig());

    // Verificar la conexión al inicializar (sin bloquear y de forma silenciosa)
    this.verifyConnection().catch(() => {
      // Silenciar el error en la inicialización para no ensuciar la consola
    });
  }

  async loadTemplate(templateName) {
    try {
      const templatePath = path.join(
        __dirname,
        "../templates",
        `${templateName}.hbs`
      );
      const templateContent = await fs.readFile(templatePath, "utf-8");
      return handlebars.compile(templateContent);
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      throw error;
    }
  }

  async sendInvoiceEmail(orderData) {
    try {
      console.log("Sending invoice email for order:", orderData.orderNumber);

      // Cargar la plantilla de factura
      const template = await this.loadTemplate("invoice");

      // Calcular datos adicionales para la plantilla
      const invoiceData = {
        ...orderData,
        // Lógica de reserva: si shipping > 0, el valor cobrado es la reserva y el resto queda pendiente
        isReservation: Number(orderData.shipping || 0) > 0,
        chargedAmount: Number(orderData.shipping || 0),
        remainingBalance: Math.max(
          0,
          Number(orderData.subtotal || 0) +
            Number(orderData.tax || 0) -
            Number(orderData.shipping || 0)
        ),
        invoiceDate: new Date().toLocaleDateString("es-EC", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        companyName: process.env.COMPANY_NAME || "Mi Panadería",
        companyEmail: process.env.COMPANY_EMAIL || process.env.EMAIL_USER,
        companyPhone: process.env.COMPANY_PHONE || "+1 (555) 123-4567",
        companyAddress:
          process.env.COMPANY_ADDRESS || "123 Calle Principal, Ciudad",
        // Formatear items para la plantilla
        formattedItems:
          orderData.items?.map((item) => ({
            ...item,
            formattedPrice: `$${item.price.toFixed(2)}`,
            formattedTotal: `$${(item.price * item.quantity).toFixed(2)}`,
          })) || [],
        // Formatear totales
        formattedSubtotal: `$${orderData.subtotal.toFixed(2)}`,
        formattedTax: `$${(orderData.tax || 0).toFixed(2)}`,
        formattedShipping: `$${(orderData.shipping || 0).toFixed(2)}`,
        formattedTotal: `$${(
          Number(orderData.subtotal || 0) + Number(orderData.tax || 0)
        ).toFixed(2)}`,
        formattedChargedAmount: `$${Number(orderData.shipping || 0).toFixed(
          2
        )}`,
        formattedRemainingBalance: `$${Math.max(
          0,
          Number(orderData.subtotal || 0) +
            Number(orderData.tax || 0) -
            Number(orderData.shipping || 0)
        ).toFixed(2)}`,
        estimatedDelivery: ["Guayaquil", "Durán", "Samborondón"].includes(
          orderData.billingCity
        )
          ? 2
          : 4,
      };

      //   const template = await this.loadTemplate('invoice');
      const htmlBeforeInline = template(invoiceData);

      // Inliner: convierte el CSS en estilos inline para máxima compatibilidad
      const htmlContent = juice(htmlBeforeInline, {
        preserveMediaQueries: false,
        removeStyleTags: true,
      });
      // Generar el HTML de la factura
      //   const htmlContent = template(invoiceData);

      // Configurar el email
      const mailOptions = {
        from:
          getDefaultFrom(),
        to: orderData.customerEmail,
        subject: `Factura de tu pedido NR.${orderData.orderNumber}`,
        html: htmlContent,
        attachments: EMAIL_LOGO_ATTACHMENT,
      };

      // Enviar el email
      const result = await this.transporter.sendMail(mailOptions);
      console.log("Invoice email sent successfully:", result.messageId);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error("Error sending invoice email:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendOrderConfirmation(orderData) {
    try {
      console.log("Sending order confirmation for:", orderData.orderNumber);

      // Plantilla simple de confirmación
      const template = await this.loadTemplate("order-confirmation");

      const isReservation = Number(orderData.shipping || 0) > 0;
      const chargedAmount = Number(orderData.shipping || 0);
      const remainingBalance = Math.max(
        0,
        Number(orderData.subtotal || 0) +
          Number(orderData.tax || 0) -
          chargedAmount
      );

      const confirmationData = {
        ...orderData,
        isReservation,
        chargedAmount,
        remainingBalance,
        formattedChargedAmount: `$${chargedAmount.toFixed(2)}`,
        formattedRemainingBalance: `$${remainingBalance.toFixed(2)}`,
        companyName: orderData.companyName || process.env.COMPANY_NAME || "DIFIORI",
        companyEmail: orderData.companyEmail || process.env.COMPANY_EMAIL || process.env.EMAIL_USER,
        companyPhone: orderData.companyPhone || process.env.COMPANY_PHONE || "",
        // createdAt: new Date(orderData.createdAt).toLocaleDateString("es-EC", {
        //   year: "numeric",
        //   month: "long",
        //   day: "numeric",
        // }),
      };

      const htmlContent = template(confirmationData);

      const mailOptions = {
        from:
          getDefaultFrom(),
        to: orderData.customerEmail,
        subject: `Confirmación de pedido #${orderData.orderNumber}`,
        html: htmlContent,
        attachments: EMAIL_LOGO_ATTACHMENT,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("Confirmation email sent successfully:", result.messageId);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error("Error sending confirmation email:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendNewOrderAlert(orderData) {
    try {
      const recipientEmail =
        orderData.recipientEmail ||
        process.env.OWNER_NOTIFICATION_EMAIL ||
        process.env.COMPANY_EMAIL ||
        "ventas@difiori.com.ec";
      const storeUrl = String(
        orderData.storeUrl ||
        process.env.STORE_URL ||
        process.env.CLIENT_URL ||
        ""
      ).trim();
      const { items, attachments: itemAttachments } = normalizeEmailItems(orderData.items, storeUrl);
      const total = Number(orderData.total || 0);
      const subtotal = Number(orderData.subtotal || 0);
      const shipping = Number(orderData.shipping || 0);
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

      const details = [
        ["Pedido", orderData.orderNumber],
        ["Fecha", orderData.createdAt],
        ["Estado de pago", orderData.paymentStatus || "PENDING"],
        ["Metodo de pago", orderData.paymentMethod || orderData.paymentLabel],
        ["Quien envia", orderData.customerName],
        ["Correo", orderData.customerEmail],
        ["Telefono", orderData.customerPhone],
        ["Quien recibe", orderData.billingContactName || orderData.receiverName],
        ["Telefono receptor", orderData.receiverPhone],
        ["Direccion", orderData.billingPrincipalAddress || orderData.exactAddress],
        ["Sector", orderData.billingCity || orderData.sector],
        ["Fecha de entrega", orderData.deliveryDateTime],
        ["Mensaje de tarjeta", orderData.cardMessage || orderData.deliveryNotes],
        ["Observaciones", orderData.observations || orderData.customerReference],
        ["Cupon", orderData.couponCode || orderData.couponDiscountCode],
      ].filter(([, value]) => value && String(value).trim() !== "");

      const detailsHtml = details
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:7px 0;color:#7c6a8d;font-size:13px;font-weight:700;width:180px;">${escapeHtml(label)}</td>
              <td style="padding:7px 0;color:#2f2438;font-size:14px;">${escapeHtml(value)}</td>
            </tr>
          `
        )
        .join("");
      const detailsText = details.map(([label, value]) => `${label}: ${value}`).join("\n");
      const itemsHtml = renderItemsTable(items);
      const itemsText = items.length
        ? items
            .map((item) =>
              `- ${item.name}${item.variantName ? ` (${item.variantName})` : ""} | Cant: ${item.quantity} | Precio: $${formatMoney(item.price)} | Total: $${formatMoney(item.lineTotal)}`
            )
            .join("\n")
        : "- Sin productos detallados";

      const whatsappPhone = String(orderData.customerPhone || orderData.phone || "")
        .replace(/[^0-9]/g, "");
      const whatsappLink = whatsappPhone
        ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
            `Hola, te escribimos de DIFIORI por tu pedido ${orderData.orderNumber}.`
          )}`
        : "";

      const mailOptions = {
        from: getDefaultFrom(),
        to: recipientEmail,
        subject: `Nuevo pedido DIFIORI - ${orderData.orderNumber}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#222;border:1px solid #eee;padding:24px;border-radius:18px;background:#fff;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;">
              <div>
                <h2 style="margin:0 0 8px;color:#77472b;">Nuevo pedido recibido</h2>
                <p style="margin:0;color:#5e4b70;">Se registró un nuevo pedido en la tienda DIFIORI.</p>
              </div>
              ${EMAIL_LOGO_HTML_SMALL}
            </div>
            <div style="margin-bottom:18px;padding:18px;border-radius:16px;background:#fff8fb;border:1px solid #f1d7e5;">
              <div style="font-size:13px;font-weight:700;color:#7c6a8d;text-transform:uppercase;letter-spacing:.08em;">Total del pedido</div>
              <div style="margin-top:8px;font-size:30px;font-weight:800;color:#3d2852;">$${formatMoney(total)}</div>
              <div style="margin-top:8px;font-size:14px;color:#5e4b70;">
                Subtotal: $${formatMoney(subtotal)} | Envío / reserva: $${formatMoney(shipping)} | Productos: ${totalItems}
              </div>
            </div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
              ${detailsHtml}
            </table>
            <h3 style="margin:18px 0 10px;color:#3d2852;">Productos</h3>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemsHtml}</table>
            ${
              whatsappLink
                ? `<p style="margin-top:24px;"><a href="${whatsappLink}" style="display:inline-block;background:#25D366;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold;">Contactar por WhatsApp</a></p>`
                : ""
            }
            <p style="margin-top:24px;font-size:12px;color:#777;">Aviso automático de pedidos DIFIORI.</p>
          </div>
        `,
        text: `Nuevo pedido recibido\n\n${detailsText}\n\nSubtotal: $${formatMoney(subtotal)}\nEnvio / reserva: $${formatMoney(shipping)}\nTotal: $${formatMoney(total)}\n\nProductos:\n${itemsText}${whatsappLink ? `\n\nWhatsApp: ${whatsappLink}` : ""}`,
        attachments: [
          ...EMAIL_LOGO_ATTACHMENT,
          ...itemAttachments,
        ],
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("New order alert sent successfully:", result.messageId);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error("Error sending new order alert:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendNewOrderAlert(orderData) {
    try {
      const recipientEmail =
        orderData.recipientEmail ||
        process.env.OWNER_NOTIFICATION_EMAIL ||
        process.env.COMPANY_EMAIL ||
        "ventas@difiori.com.ec";
      const storeUrl = String(
        orderData.storeUrl ||
        process.env.STORE_URL ||
        process.env.CLIENT_URL ||
        ""
      ).trim();
      const { items, attachments: itemAttachments } = normalizeEmailItems(orderData.items, storeUrl);
      const total = Number(orderData.total || 0);
      const subtotal = Number(orderData.subtotal || 0);
      const shipping = Number(orderData.shipping || 0);
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

      const details = [
        ["Pedido", orderData.orderNumber],
        ["Fecha", orderData.createdAt],
        ["Estado de pago", orderData.paymentStatus || "PENDING"],
        ["Metodo de pago", orderData.paymentMethod || orderData.paymentLabel],
        ["Quien envia", orderData.customerName],
        ["Correo", orderData.customerEmail],
        ["Telefono", orderData.customerPhone],
        ["Quien recibe", orderData.billingContactName || orderData.receiverName],
        ["Telefono receptor", orderData.receiverPhone],
        ["Direccion", orderData.billingPrincipalAddress || orderData.exactAddress],
        ["Sector", orderData.billingCity || orderData.sector],
        ["Fecha de entrega", orderData.deliveryDateTime],
        ["Mensaje de tarjeta", orderData.cardMessage || orderData.deliveryNotes],
        ["Observaciones", orderData.observations || orderData.customerReference],
        ["Cupon", orderData.couponCode || orderData.couponDiscountCode],
      ].filter(([, value]) => value && String(value).trim() !== "");

      const detailsHtml = details
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:10px 0;color:#7c6a8d;font-size:15px;font-weight:800;width:200px;">${escapeHtml(label)}</td>
              <td style="padding:10px 0;color:#2f2438;font-size:17px;line-height:1.45;">${escapeHtml(value)}</td>
            </tr>
          `
        )
        .join("");
      const detailsText = details.map(([label, value]) => `${label}: ${value}`).join("\n");
      const itemsHtml = renderItemsTable(items);
      const itemsText = items.length
        ? items
            .map((item) =>
              `- ${item.name}${item.variantName ? ` (${item.variantName})` : ""} | Cant: ${item.quantity} | Precio: $${formatMoney(item.price)} | Total: $${formatMoney(item.lineTotal)}`
            )
            .join("\n")
        : "- Sin productos detallados";

      const whatsappPhone = String(orderData.customerPhone || orderData.phone || "")
        .replace(/[^0-9]/g, "");
      const whatsappLink = whatsappPhone
        ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
            `Hola, te escribimos de DIFIORI por tu pedido ${orderData.orderNumber}.`
          )}`
        : "";

      const mailOptions = {
        from: getDefaultFrom(),
        to: recipientEmail,
        subject: `Nuevo pedido DIFIORI - ${orderData.orderNumber}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;color:#222;border:1px solid #eee;padding:28px;border-radius:22px;background:#fff;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;">
              <div>
                <div style="font-size:14px;font-weight:800;color:#7c6a8d;text-transform:uppercase;letter-spacing:.12em;">Nuevo pedido DIFIORI</div>
                <h2 style="margin:10px 0 8px;color:#77472b;font-size:34px;line-height:1.15;">Pedido ${escapeHtml(orderData.orderNumber || "")}</h2>
                <p style="margin:0;font-size:18px;line-height:1.5;color:#5e4b70;">Se registro un nuevo pedido en la tienda. Primero veras el producto y luego todo el detalle del cliente.</p>
              </div>
              ${EMAIL_LOGO_HTML_LARGE}
            </div>
            <h3 style="margin:0 0 12px;color:#3d2852;font-size:28px;">Productos del pedido</h3>
            <p style="margin:0 0 12px;font-size:17px;color:#5e4b70;">Cantidad total de productos: <strong>${totalItems}</strong></p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">${itemsHtml}</table>
            <div style="margin-bottom:22px;padding:20px 22px;border-radius:18px;background:#fff8fb;border:1px solid #f1d7e5;">
              <div style="font-size:14px;font-weight:800;color:#7c6a8d;text-transform:uppercase;letter-spacing:.1em;">Total del pedido</div>
              <div style="margin-top:10px;font-size:38px;font-weight:900;color:#3d2852;">$${formatMoney(total)}</div>
              <div style="margin-top:10px;font-size:17px;line-height:1.6;color:#5e4b70;">
                Subtotal: $${formatMoney(subtotal)}<br />
                Envio / reserva: $${formatMoney(shipping)}<br />
                Productos: ${totalItems}
              </div>
            </div>
            <h3 style="margin:0 0 12px;color:#3d2852;font-size:28px;">Detalle completo</h3>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
              ${detailsHtml}
            </table>
            ${
              whatsappLink
                ? `<p style="margin-top:26px;"><a href="${whatsappLink}" style="display:inline-block;background:#25D366;color:#fff;padding:16px 24px;border-radius:999px;text-decoration:none;font-weight:800;font-size:18px;">Contactar por WhatsApp</a></p>`
                : ""
            }
            <p style="margin-top:28px;font-size:13px;color:#777;">Aviso automatico de pedidos DIFIORI.</p>
          </div>
        `,
        text: `Nuevo pedido recibido\n\n${detailsText}\n\nSubtotal: $${formatMoney(subtotal)}\nEnvio / reserva: $${formatMoney(shipping)}\nTotal: $${formatMoney(total)}\n\nProductos:\n${itemsText}${whatsappLink ? `\n\nWhatsApp: ${whatsappLink}` : ""}`,
        attachments: [
          ...EMAIL_LOGO_ATTACHMENT,
          ...itemAttachments,
        ],
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("New order alert sent successfully:", result.messageId);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error("Error sending new order alert:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendDiscountCodeEmail(discount_code, customerEmail) {
    try {
      console.log("Sending discount code email:", discount_code);

      // Cargar la plantilla de factura
      const template = await this.loadTemplate("discount_code");

      // Calcular datos adicionales para la plantilla
      const emailData = {
        discountCode: discount_code,
        storeUrl: process.env.STORE_URL || 'https://perfumeriasz.com',
        companyName: process.env.COMPANY_NAME || "Mi Panadería",
        companyEmail: process.env.COMPANY_EMAIL || process.env.EMAIL_USER
      };

      //   const template = await this.loadTemplate('invoice');
      const htmlBeforeInline = template(emailData);

      // Inliner: convierte el CSS en estilos inline para máxima compatibilidad
      const htmlContent = juice(htmlBeforeInline, {
        preserveMediaQueries: false,
        removeStyleTags: true,
      });
      // Generar el HTML de la factura
      //   const htmlContent = template(invoiceData);

      // Configurar el email
      const mailOptions = {
        from:
          getDefaultFrom(),
        to: customerEmail,
        subject: `Código de descuento`,
        html: htmlContent,
        attachments: [
          // Opcional: adjuntar logo u otros archivos
          /*
          {
            filename: 'logo.png',
            path: path.join(__dirname, '../assets/logo.png'),
            cid: 'logo' // Para usar en el HTML como <img src="cid:logo"/>
          }
          */
        ],
      };

      // Enviar el email
      const result = await this.transporter.sendMail(mailOptions);
      console.log("Discount code email sent successfully:", result.messageId);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error("Error sending invoice email:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async verifyConnection() {
    try {
      if (!this.transporter) return false;
      await this.transporter.verify();
      console.log("✅ Email service ready");
      return true;
    } catch (error) {
      console.log("⚠️  Email service: Credentials pending/invalid (Ready to use when configured)");
      return false;
    }
  }
}

module.exports = new EmailService();
