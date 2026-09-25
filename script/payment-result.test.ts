/**
 * Prueba del título que ve el cliente cuando el pago no se completa.
 * Se ejecuta con `npx tsx script/payment-result.test.ts`.
 */

import assert from "node:assert";
import { describirResultadoDePago } from "../client/src/pages/PaymentResult";

let fallos = 0;

function probar(nombre: string, ejecutar: () => void) {
  try {
    ejecutar();
    console.log(`✓ ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.error(`✗ ${nombre}`);
    console.error(`   ${error instanceof Error ? error.message : error}`);
  }
}

probar("Quien no aprobó el pago no ve 'Pago rechazado'", () => {
  const r = describirResultadoDePago(
    "error",
    "No llegaste a aprobar el pago en PayPal. Puedes intentarlo de nuevo.",
  );

  assert.strictEqual(r.titulo, "No se completó el pago");
  assert.strictEqual(r.pagoSinCompletar, true);
});

probar("Sesión caducada: mismo trato, no es un rechazo", () => {
  const r = describirResultadoDePago("error", "La sesión de pago caducó. Vuelve al checkout.");
  assert.strictEqual(r.pagoSinCompletar, true);
});

probar("Una tarjeta rechazada sí se llama rechazo", () => {
  const r = describirResultadoDePago("failed", "Tu banco rechazó el pago. Prueba con otra tarjeta.");

  assert.strictEqual(r.titulo, "Pago rechazado");
  assert.strictEqual(r.pagoSinCompletar, false);
});

probar("Un fallo técnico sigue siendo un error", () => {
  const r = describirResultadoDePago("error", "PayPal está teniendo problemas en este momento.");

  assert.strictEqual(r.titulo, "Error en el pago");
  assert.strictEqual(r.pagoSinCompletar, false);
});

probar("Sin mensaje no inventa que el cliente abandonó", () => {
  assert.strictEqual(describirResultadoDePago("error", "").titulo, "Error en el pago");
  assert.strictEqual(describirResultadoDePago("failed", "").titulo, "Pago rechazado");
});

if (fallos > 0) {
  console.error(`\n${fallos} prueba(s) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nLa pantalla de resultado nombra cada caso como es.");
}
