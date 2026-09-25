/**
 * Traduce los errores de PayPal a algo que el cliente entienda y pueda resolver.
 *
 * PayPal responde en inglés y con frases como "The requested action could not be
 * performed, semantically incorrect, or failed business validation", que llegaban
 * tal cual a la pantalla de pago. El motivo real viene en `details[0].issue`.
 *
 * Distingue tres situaciones que no son lo mismo:
 *  - el pago ya se cobró (no es un error: hay que darlo por bueno, no cobrar dos veces),
 *  - el cliente no llegó a aprobar el pago (puede reintentar),
 *  - algo falló de verdad (conviene ofrecer WhatsApp).
 */

const ERRORES = {
  ORDER_ALREADY_CAPTURED: {
    mensaje: "Este pago ya se había completado.",
    yaPagado: true,
    reintentable: false,
  },
  ORDER_NOT_APPROVED: {
    mensaje: "No llegaste a aprobar el pago en PayPal. Puedes intentarlo de nuevo.",
    reintentable: true,
  },
  PAYER_ACTION_REQUIRED: {
    mensaje: "PayPal necesita que confirmes el pago desde tu cuenta antes de continuar.",
    reintentable: true,
  },
  INSTRUMENT_DECLINED: {
    mensaje:
      "Tu banco rechazó el pago. Prueba con otra tarjeta o con otro método; el pedido sigue guardado.",
    reintentable: true,
  },
  PAYMENT_DENIED: {
    mensaje: "PayPal rechazó el pago. Intenta con otro método o escríbenos por WhatsApp.",
    reintentable: true,
  },
  TRANSACTION_REFUSED: {
    mensaje: "PayPal no aceptó la transacción. Intenta con otro método de pago.",
    reintentable: true,
  },
  ORDER_EXPIRED: {
    mensaje: "La sesión de pago caducó. Vuelve al checkout y confirma de nuevo tu pedido.",
    reintentable: true,
  },
  ORDER_ALREADY_COMPLETED: {
    mensaje: "Este pago ya se había completado.",
    yaPagado: true,
    reintentable: false,
  },
  COMPLIANCE_VIOLATION: {
    mensaje: "PayPal bloqueó la operación. Escríbenos por WhatsApp y la resolvemos contigo.",
    reintentable: false,
  },
  INTERNAL_SERVER_ERROR: {
    mensaje: "PayPal está teniendo problemas en este momento. Intenta de nuevo en unos minutos.",
    reintentable: true,
  },
};

const POR_DEFECTO = {
  mensaje: "No se pudo completar el pago con PayPal. Intenta de nuevo o escríbenos por WhatsApp.",
  reintentable: true,
  yaPagado: false,
};

/**
 * @param {object} data respuesta JSON de PayPal
 * @param {number} status código HTTP devuelto por PayPal
 * @returns {{issue: string|null, mensaje: string, reintentable: boolean, yaPagado: boolean}}
 */
function interpretarErrorPaypal(data, status) {
  const detalle = Array.isArray(data?.details) ? data.details[0] : null;
  const issue = String(detalle?.issue || data?.name || "").toUpperCase() || null;
  const conocido = issue ? ERRORES[issue] : null;

  if (conocido) {
    return {
      issue,
      mensaje: conocido.mensaje,
      reintentable: Boolean(conocido.reintentable),
      yaPagado: Boolean(conocido.yaPagado),
    };
  }

  // Sin un motivo reconocible, al menos se distingue "PayPal está caído" de
  // "PayPal rechazó esto": la salida para el cliente no es la misma.
  if (status >= 500) {
    return {
      issue,
      mensaje: ERRORES.INTERNAL_SERVER_ERROR.mensaje,
      reintentable: true,
      yaPagado: false,
    };
  }

  return { issue, ...POR_DEFECTO };
}

module.exports = { interpretarErrorPaypal, ERRORES };
