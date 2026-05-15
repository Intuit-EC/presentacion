const { db } = require("../../lib/prisma.js");
const emailService = require("../../services/emailService");
const { orderEvents } = require("../../events/orderEvents");
const { nanoid } = require("nanoid");
const { getEffectivePriceForProduct, isDiscountActive, normalizeDiscountCode } = require("../../utils/discountRules");
const {
  createOrderRequestSchema,
} = require("../../utils/schemas/createOrderRequestSchema.js");
const {
  emailSuscriptionSchema,
} = require("../../utils/schemas/saveEmailSuscriptionSchema.js")
const { businessLog, businessError } = require("../../utils/logger");

const { generateOrderNumber } = require("../../utils/order.js");
const { validateFeatureAccess } = require("../../validations/featureValidation.js");

function roundMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function loadProductsForPricing(productIds) {
  const products = await db.product.findMany({
    where: {
      id: { in: productIds },
      isDeleted: false,
    },
    include: {
      variants: {
        where: { isDeleted: false, isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      discounts_products: {
        where: {
          discounts: {
            is_active: true,
          },
        },
        include: {
          discounts: true,
        },
      },
    },
  });

  const byId = new Map(products.map((p) => [p.id, p]));
  return byId;
}

function pickVariant(product, requestedVariantId) {
  if (!product?.hasVariants) return null;
  const variants = product.variants || [];
  if (requestedVariantId) {
    return variants.find((v) => v.id === requestedVariantId) || null;
  }
  return variants.find((v) => v.isDefault) || variants[0] || null;
}

function computeProductUnitPrice(product, variant) {
  if (variant) return Number(variant.price);
  const price = Number(product?.price);
  if (!Number.isFinite(price)) return 0;
  return price;
}

exports.processCheckout = async (req, res) => {
  const startedAt = Date.now();
  try {
    const parseResult = createOrderRequestSchema.safeParse(req.body);
    const TAX_RATE = 0.15;

    if (!parseResult.success) {
      return res.status(400).json({
        status: "error",
        message: "Datos inválidos",
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { billingData, orderData } = parseResult.data;

    businessLog("CHECKOUT", "STARTED", {
      customerName: billingData.customerName,
      customerLastName: billingData.customerLastName,
      customerEmail: billingData.customerEmail,
      customerPhone: billingData.customerPhone,
      itemsCount: orderData.OrderItem.length,
      paymentStatus: orderData.paymentStatus,
      couponDiscountCode: orderData.couponDiscountCode || null,
      discountCode: orderData.discountCode || null,
    });
    // Generar número de orden único
    const orderNumber = await generateOrderNumber();

    const productIds = orderData.OrderItem.map((i) => i.productId);
    const productsById = await loadProductsForPricing(productIds);


    // INICIO LÓGICA DESCUENTOS POR PRODUCTOS
    const now = new Date();
    const computedItems = [];
    let productDiscountAmount = 0;
    let subtotalBeforeCoupon = 0;
    for (const item of orderData.OrderItem) {
      const product = productsById.get(item.productId);
      if (!product) {
        return res.status(400).json({
          status: "error",
          message: `Producto no encontrado: ${item.productId}`,
        });
      }

      const variant = pickVariant(product, item.variantId || null);
      const baseUnitPrice = computeProductUnitPrice(product, variant);

      // Product-level discounts should be automatic. Discounts that have a `code` are treated as coupons
      // and should only apply when the user enters the code (order-level), not automatically per item.
      const productDiscounts = (product.discounts_products || [])
        .map((dp) => dp.discounts)
        .filter((d) => !d?.code);
      const { effectivePrice } = getEffectivePriceForProduct(productDiscounts, now, baseUnitPrice);
      const discountedUnitPrice = roundMoney(effectivePrice);

      const discounts_applied = productDiscounts
        .filter((d) => isDiscountActive(d, now))
        .map((d) => d.percent)
        .filter(Boolean)
        .join("-");

      const discounts_ids = productDiscounts
        .filter((d) => isDiscountActive(d, now))
        .map((d) => d.id)
        .filter(Boolean)
        .join("-");

      const lineList = roundMoney(baseUnitPrice * item.quantity);
      const lineAfter = roundMoney(discountedUnitPrice * item.quantity);
      productDiscountAmount = roundMoney(productDiscountAmount + (lineList - lineAfter));
      subtotalBeforeCoupon = roundMoney(subtotalBeforeCoupon + lineAfter);

      computedItems.push({
        quantity: item.quantity,
        productId: product.id,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? item.variantName ?? null,
        unitPrice: discountedUnitPrice,
        discounts_applied,
        discounts_ids
      });
    }
    // FIN LÓGICA DESCUENTOS POR PRODUCTOS

    const rawCouponDiscountCode = orderData.couponDiscountCode ?? null;
    const normalizedCouponDiscountCode = normalizeDiscountCode(rawCouponDiscountCode);


    // const rawDiscountCode = orderData.discountCode ?? null;
    // const normalizedCode = normalizeDiscountCode(rawDiscountCode);
    let couponDiscountPercent = null;
    let couponDiscountAmount = 0;
    let couponDiscountId = null;
    let legacyEmailSubscriptionToConsume = null;

    let runningSubtotal = subtotalBeforeCoupon;

    if (normalizedCouponDiscountCode) {
      const couponDiscount = await db.discounts.findFirst({
        where: {
          code: normalizedCouponDiscountCode,
        },
      });

      if (couponDiscount && isDiscountActive(couponDiscount, now)) {
        couponDiscountPercent = couponDiscount.percent ?? null;

        if (couponDiscountPercent) {
          const pv = Number(couponDiscount.percent_value ?? 0);
          const amount = roundMoney(runningSubtotal * pv);
          couponDiscountAmount = amount;
          runningSubtotal -= amount;
          couponDiscountId = couponDiscount.id;
          runningSubtotal = Math.max(0, runningSubtotal);
        }
      }
    }
    
    let discountCodePercent = null;
    let discountCodeAmount = 0;
    let discountCodeId = null;

    console.log("DISCOUNT CODE ANTES DEL IF: ", orderData.discountCode)
    if (orderData.discountCode) {
      // Compatibilidad: códigos por email (email_suscriptions) + % global tipo=2
      const subscription = await db.email_suscriptions.findFirst({
        where: { discount_code: orderData.discountCode },
        select: { email: true, is_used: true },
      });
      console.log("EMAIL SUSCRIPTION FROM DATABASE: ", subscription);
      if (subscription) {
        if (subscription.is_used) {
          return res.status(409).json({
            status: "error",
            code: "ALREADY_USED",
            message: "Este código ya ha sido utilizado.",
          });
        }

        const globalPercent = await db.discounts.findFirst({
          where: { discount_type: 2 },
        });

        if (globalPercent) {
          discountCodePercent = globalPercent.percent ?? null;
          if (discountCodePercent) {
            const pv = Number(globalPercent.percent_value ?? 0);
            const amount = roundMoney(runningSubtotal * pv);
            discountCodeAmount = amount;
            runningSubtotal -= amount;
            legacyEmailSubscriptionToConsume = subscription;
            runningSubtotal = Math.max(0, runningSubtotal);
            discountCodeId = globalPercent.id;
          }
        }
      }
    }

    const subtotalAfterDiscountCode = roundMoney(runningSubtotal);
    const totalDiscountAmount = roundMoney(productDiscountAmount + couponDiscountAmount + discountCodeAmount);
    const shipping = roundMoney(Number(orderData.shipping ?? 0));
    // const tax = roundMoney(Number(orderData.tax ?? 0));
    const tax = roundMoney(subtotalAfterDiscountCode * TAX_RATE)
    const total = roundMoney(subtotalAfterDiscountCode + tax /*+ shipping*/); // NO SUMAR SHIPPING, SHIPPING ES EL VAOR DE RESERVA

    const createdOrder = await db.$transaction(async (tx) => {
      if (couponDiscountId) {
        // Incremento de uso del cupón solo cuando se crea la orden
        await tx.discounts.update({
          where: { id: couponDiscountId },
          data: { uses: { increment: 1 } },
        });
      }

      if (legacyEmailSubscriptionToConsume) {
        await tx.email_suscriptions.update({
          where: { email: legacyEmailSubscriptionToConsume.email },
          data: { is_used: true },
        });
      }



      return tx.order.create({
        data: {
          orderNumber: orderNumber.sequence,
          sequentialNumber: orderNumber.currentNumber,
          customerName: billingData.customerName,
          customerLastName: billingData.customerLastName,
          customerProvince: billingData.customerProvince,
          billingPrincipalAddress: billingData.billingPrincipalAddress,
          billingSecondAddress: billingData.billingSecondAddress,
          billingCity: billingData.billingCity,
          customerReference: billingData.customerReference,
          deliveryNotes: billingData.deliveryNotes,
          orderNotes: billingData.orderNotes,
          billingContactName: billingData.billingContactName,
          Courier: billingData.Courier,
          customerEmail: billingData.customerEmail,
          customerPhone: billingData.customerPhone,
          // Discounts data
          total_discount_amount: totalDiscountAmount, // Monto total de descuentos aplicados
          product_discounted_amount: productDiscountAmount, // Monto descontado por tipo por producto
          code_discounted_amount: discountCodeAmount, // Monto descontado por tipo código
          coupon_discounted_amount: couponDiscountAmount, // Monto descontado por tipo cupón
          discount_coupon_percent: couponDiscountPercent, // Porcentaje de descuento por tipo cupón
          discount_code_percent: discountCodePercent, // Porcentaje de descuento por tipo código
          discount_coupon_id: couponDiscountId, // Id del cupón aplicado
          discount_code_id: discountCodeId, // Id del descuento aplicado (2)
          // Total discount applied to the order (product discounts + coupon discount + discount code)
          subtotal: subtotalAfterDiscountCode, // Subtotal despues de aplicar todos los descuentos
          tax, // Iva calculado despues de aplicar todos los descuentos
          shipping, // Reserva
          total, // Total despues de aplicar descuentos y sumar iva
          paymentStatus: orderData.paymentStatus,
          createdAt: new Date().toISOString(),
          paidAt: orderData.paidAt ? new Date(orderData.paidAt) : null,
          orderItems: {
            create: computedItems.map((item) => ({
              quantity: item.quantity,
              price: item.unitPrice, // Precio unitario con descuentos aplicados segun los que tenga asociados
              variantName: item.variantName,
              variantId: item.variantId,
              discounts_percents: item.discounts_applied, // Descuentos aplicados al producto
              discounts_ids: item.discounts_ids,
              product: {
                connect: { id: item.productId },
              },
            })),
          },
        },
        include: {
          orderItems: {
            include: { product: true },
          },
        },
      });
    });

    businessLog("ORDER", "CREATED", {
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      customerName: createdOrder.customerName,
      customerEmail: createdOrder.customerEmail,
      customerPhone: createdOrder.customerPhone,
      status: createdOrder.status,
      paymentStatus: createdOrder.paymentStatus,
      total: Number(createdOrder.total || 0),
      itemsCount: createdOrder.orderItems?.length || 0,
      source: "CHECKOUT_API",
      durationMs: Date.now() - startedAt,
    });

    // Emitir evento de creación para SSE
    orderEvents.emit("order.created", {
      id: createdOrder.id,
      status: createdOrder.status,
      order: createdOrder.orderNumber,
      customerName: createdOrder.customerName,
      customerEmail: createdOrder.customerEmail,
      createdAt: createdOrder.createdAt,
    });

    try {
      console.log("Sending confirmation and invoice emails...");

      // Preparar datos para el email
      const emailData = {
        ...createdOrder,
        createdAt: createdOrder.createdAt.toLocaleDateString("es-EC", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        items: createdOrder.orderItems.map((item) => ({
          productName: item.product.name,
          variantName: item.variantName,
          quantity: item.quantity,
          price: item.price,
          productImage: item.product.image,
        })),
      };

      // Enviar factura por email
      const invoiceResult = await emailService.sendInvoiceEmail(emailData);
      if (invoiceResult.success) {
        console.log("Invoice email sent successfully");
      } else {
        console.error("Failed to send invoice email:", invoiceResult.error);
      }
    } catch (emailError) {
      // No fallar el webhook por errores de email, solo logear
      console.error("Error sending emails:", emailError);
    }

    return res.status(200).json({
      status: "success",
      message: "Checkout session creada",
      data: {
        orderNumber,
        pricing: {
          subtotalBeforeProductDiscounts: roundMoney(subtotalBeforeCoupon + productDiscountAmount),
          productDiscountAmount,
          subtotalBeforeCoupon,
          couponDiscountAmount,
          discountAmount: totalDiscountAmount,
          subtotal: subtotalAfterDiscountCode,
          tax,
          shipping,
          total,
          couponDiscount: normalizedCouponDiscountCode,
          discountCode: legacyEmailSubscriptionToConsume?.discount_code ?? null,
          discountCodePercent: discountCodePercent,
          couponDiscountPercent
        },
      },
    });
  } catch (error) {
    businessError("CHECKOUT", "FAILED", error, {
      customerEmail: req.body?.billingData?.customerEmail,
      customerPhone: req.body?.billingData?.customerPhone,
      durationMs: Date.now() - startedAt,
    });
    console.error("Checkout API: Error creating checkout session:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return res.status(500).json({
      status: "error",
      message: "Failed to create checkout session",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};


function generateDiscountCode() {
  return nanoid(10).toUpperCase(); // Ej: "AJD92KS91Q"
}

exports.saveEmailSuscription = async (req, res) => {
  try {
    const parseResult = emailSuscriptionSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        status: "error",
        message: "Datos inválidos",
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { email } = req.body;

    console.log("Checkout API: Received email:", email);

    // 🔍 1. Verificar si ya existe
    const existing = await db.email_suscriptions.findFirst({
      where: {
        email
      },
      select: {
        email: true,
        is_used: true
      },
    });

    // 2. Generar código
    const discount_code = generateDiscountCode();

    if (existing) {
      if (existing.is_used) {
        return res.status(409).json({
          status: "error",
          code: "EMAIL_ALREADY_REGISTERED",
          message: "Este email ya ha usado un código de descuento previamente.",
          alreadyRegistered: true,
        });
      }
      // 3. Enviar email con el código
      const emailResult = await emailService.sendDiscountCodeEmail(discount_code, email);

      if (!emailResult.success) {
        console.error("Failed to send discount email:", emailResult.error);

        return res.status(503).json({
          status: "error",
          error: "EMAIL_DELIVERY_FAILED",
          message: "No se pudo enviar el correo. Intenta nuevamente.",
          retryable: true,
        });
      }

      const saveEmailSuscription = await db.email_suscriptions.update({
        data: {
          discount_code,
        },
        where: {
          email,
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Código reenviado, revise su bandeja de entrada.",
        data: saveEmailSuscription,
      });
    }

    // 3. Enviar email con el código
    const emailResult = await emailService.sendDiscountCodeEmail(discount_code, email);

    if (!emailResult.success) {
      console.error("Failed to send discount email:", emailResult.error);

      return res.status(503).json({
        status: "error",
        error: "EMAIL_DELIVERY_FAILED",
        message: "No se pudo enviar el correo. Intenta nuevamente.",
        retryable: true,
      });
    }

    // 4. Guardar en BD
    const saveEmailSuscription = await db.email_suscriptions.create({
      data: {
        email,
        discount_code,
      }
    });

    return res.status(200).json({
      status: "success",
      message: "Código enviado y suscripción guardada.",
      data: saveEmailSuscription,
    });

  } catch (error) {

    console.error("Error saving email:", error);

    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor",
    });
  }
};

exports.getDiscount = async (req, res) => {
  try {
    const hasAccessToFeature = await validateFeatureAccess('discounts', req.headers.host);
    // const hasAccessToFeature = null; // Deshabilitado temporalmente
    
    if (!hasAccessToFeature) {
      return res.status(404).json({
        status: "error",
        message: "No se encontró un porcentaje de descuento para aplicar.",
        data: null,
      });
    }

    const code = req.query?.code ?? null;

    if (code) {
      const existingByCode = await db.email_suscriptions.findFirst({
        where: { discount_code: code },
        select: {
          email: true,
          discount_code: true,
          is_used: true,
          sent_at: true
        },
      });
      

      if (!existingByCode) {
        return res.status(404).json({
          status: "error",
          message: "No se encontró un código de descuento válido para aplicar.",
          data: null,
        });
      }

      // 1. Verificar si ya existe
      const discount = await db.discounts.findFirst({
        where: {
          discount_type: 2,
          is_active: true
        },
        select: {
          percent: true,
          percent_value: true,
          display_description: true,
          description: true
        },
      });

      if (!discount) {
        return res.status(404).json({
          status: "error",
          message: "No se encontró un porcentaje de descuento para aplicar.",
          data: null
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Porcentaje de descuento a aplicar.",
        data: discount,
      });
    }

    // 1. Verificar si ya existe
    const discount = await db.discounts.findFirst({
      where: {
        discount_type: 2,
        is_active: true
      },
      select: {
        percent: true,
        percent_value: true,
        display_description: true,
        description: true
      },
    });

    if (!discount) {
      return res.status(404).json({
        status: "error",
        message: "No se encontró un porcentaje de descuento para aplicar.",
        data: null
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Porcentaje de descuento a aplicar.",
      data: discount,
    });

  } catch (error) {
    console.error("Error getting discount percent:", error);

    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor",
    });
  }
};

// Asegúrate de que tienes un acceso a la instancia de Prisma llamada 'db'
// const { db } = require("../../lib/prisma.js"); 

exports.validateUseDiscountCode = async (req, res) => {
    const { code, email } = req.body;

    if (!code) {
        return res.status(400).json({
            status: "error",
            message: "Faltan datos: código es obligatorio.",
        });
    }

    try {
        await db.$transaction(async (tx) => {
            // A. Buscar el código
            let subscription;

            subscription = email.trim() === "" ? await tx.email_suscriptions.findFirst({
                where: {
                    discount_code: code,
                },
            })
            : await tx.email_suscriptions.findFirst({
              where: {
                email,
                discount_code: code,
              }
            });

            if (!subscription) {
                // Si no se encuentra, lanzamos un error conocido
                throw new Error("NOT_FOUND");
            }

            if (subscription.is_used) {
                // Si ya se usó, lanzamos un error conocido
                throw new Error("ALREADY_USED");
            }

            // B. Actualizar is_used = true (DISPARA TRIGGER y CHECK CONSTRAINT)
            // Si el código está expirado (violación del CHECK), Prisma lanzará el error aquí.
            // await tx.email_suscriptions.update({
            //     where: { email: subscription.email },
            //     data: {
            //         is_used: true,
            //     }
            // });
            // Si llega aquí, la transacción es válida.
        });

        // ÚNICA RESPUESTA DE ÉXITO: Se envía solo si la transacción fue completada.
        return res.status(200).json({
            status: "success",
            message: "El código es válido.",
            data: true
        });

    } catch (error) {
        // MANEJO CENTRALIZADO DE ERRORES: Se envía solo si la transacción falló.

        const errorMessage = (error.message || '').toLowerCase();

        // 1. Errores Lógicos lanzados dentro de la transacción
        if (errorMessage.includes('not_found')) {
             return res.status(404).json({
                status: "error",
                message: "Código de descuento no válido o no encontrado para este email.",
                data: false
             });
        }
        
        if (errorMessage.includes('already_used')) {
             return res.status(409).json({
                status: "error",
                message: "Este código ya ha sido utilizado.",
                data: false
             });
        }
        
        // Error genérico
        console.error("Error aplicando descuento:", error);
        return res.status(500).json({
            status: "error",
            message: "Error interno del servidor al aplicar el descuento.",
            data: false
        });
    }
};

exports.getCouponDiscount = async (req, res) => {
  const code = req.query?.code ?? null;

  if (!code) {
    return res.status(400).json({
      status: "error",
      message: "Faltan datos: código es obligatorio.",
      data: null,
    });
  }

  try {
    const now = new Date();
    const coupon = await db.coupons.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        minAmount: true,
        maxUsesTotal: true,
        usesTotal: true,
      },
    });

    if (!coupon) {
      return res.status(404).json({
        status: "error",
        message: "Cupón no válido, vencido o no encontrado.",
        data: null,
      });
    }

    if (coupon.maxUsesTotal && coupon.usesTotal >= coupon.maxUsesTotal) {
      return res.status(400).json({
        status: "error",
        message: "Este cupón ha agotado su límite de usos.",
        data: null,
      });
    }

    // Adapt response for storefront compatibility
    const result = {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      percent: coupon.type === "PERCENTAGE" ? coupon.value : null,
      percent_value:
        coupon.type === "PERCENTAGE" ? coupon.value / 100 : coupon.value,
      amount: coupon.type === "FIXED" ? coupon.value : null,
      minAmount: coupon.minAmount,
    };

    return res.status(200).json({
      status: "success",
      message: "Cupón válido encontrado.",
      data: result,
    });
  } catch (error) {
    console.error("Error getting coupon discount:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor",
      data: null,
    });
  }
};
