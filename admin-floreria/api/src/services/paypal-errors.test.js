/**
 * Pruebas de los mensajes de PayPal: lo que lee el cliente cuando el pago no sale.
 * Se ejecuta con `node src/services/paypal-errors.test.js`.
 */

const assert = require("node:assert");
const { interpretarErrorPaypal } = require("./paypal-errors");

let fallos = 0;

function probar(nombre, ejecutar) {
  try {
    ejecutar();
    console.log(`✓ ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.error(`✗ ${nombre}`);
    console.error(`   ${error instanceof Error ? error.message : error}`);
  }
}

// Respuesta real de PayPal cuando el comprador no aprobó el pago.
const NO_APROBADO = {
  name: "UNPROCESSABLE_ENTITY",
  message:
    "The requested action could not be performed, semantically incorrect, or failed business validation.",
  details: [{ issue: "ORDER_NOT_APPROVED", description: "Payer has not yet approved the Order" }],
};

probar("El cliente que no aprobó el pago lo entiende y puede reintentar", () => {
  const r = interpretarErrorPaypal(NO_APROBADO, 422);

  assert.strictEqual(r.issue, "ORDER_NOT_APPROVED");
  assert.match(r.mensaje, /no llegaste a aprobar/i);
  assert.strictEqual(r.reintentable, true);
  assert.strictEqual(r.yaPagado, false);
  assert.doesNotMatch(r.mensaje, /semantically|business validation/i, "nada de inglés crudo");
});

probar("Un pago ya cobrado NO se trata como error: evitaría cobrar dos veces", () => {
  const r = interpretarErrorPaypal(
    { details: [{ issue: "ORDER_ALREADY_CAPTURED" }] },
    422,
  );

  assert.strictEqual(r.yaPagado, true);
  assert.strictEqual(r.reintentable, false);
});

probar("Tarjeta rechazada: se invita a usar otra, sin culpar al cliente", () => {
  const r = interpretarErrorPaypal({ details: [{ issue: "INSTRUMENT_DECLINED" }] }, 422);

  assert.match(r.mensaje, /otra tarjeta|otro método/i);
  assert.strictEqual(r.reintentable, true);
});

probar("Sesión caducada: se explica que hay que volver al checkout", () => {
  const r = interpretarErrorPaypal({ details: [{ issue: "ORDER_EXPIRED" }] }, 422);
  assert.match(r.mensaje, /caduc/i);
  assert.strictEqual(r.reintentable, true);
});

probar("PayPal caído: se distingue de un rechazo y se invita a esperar", () => {
  const r = interpretarErrorPaypal({}, 503);

  assert.match(r.mensaje, /unos minutos/i);
  assert.strictEqual(r.reintentable, true);
});

probar("Un motivo desconocido no deja al cliente sin salida", () => {
  const r = interpretarErrorPaypal({ details: [{ issue: "ALGO_NUEVO_DE_PAYPAL" }] }, 422);

  assert.match(r.mensaje, /WhatsApp|intenta/i);
  assert.strictEqual(r.reintentable, true);
});

probar("Un bloqueo por cumplimiento no invita a reintentar en vano", () => {
  const r = interpretarErrorPaypal({ details: [{ issue: "COMPLIANCE_VIOLATION" }] }, 422);

  assert.strictEqual(r.reintentable, false);
  assert.match(r.mensaje, /WhatsApp/i);
});

probar("Nunca devuelve un mensaje vacío", () => {
  for (const caso of [{}, null, { details: [] }, { name: "X" }]) {
    const r = interpretarErrorPaypal(caso, 400);
    assert.ok(r.mensaje && r.mensaje.length > 10, "el cliente siempre debe leer algo útil");
  }
});

if (fallos > 0) {
  console.error(`\n${fallos} prueba(s) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nLos errores de PayPal se explican en español y con una salida clara.");
}
