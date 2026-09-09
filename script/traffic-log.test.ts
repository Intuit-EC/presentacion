/**
 * Prueba de la medición de visitas. Se ejecuta con `npx tsx` y no necesita
 * servidor ni base de datos.
 */

import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TRAFFIC_LOG_PATH = join(mkdtempSync(join(tmpdir(), "traffic-")), "traffic.json");

const { registrarVisita, obtenerResumen, clasificarRuta, _reiniciarParaPruebas } = await import(
  "../server/traffic-log"
);

const NAVEGADOR =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

let fallos = 0;

function comprobar(nombre: string, ejecutar: () => void) {
  try {
    _reiniciarParaPruebas();
    ejecutar();
    console.log(`✓ ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.error(`✗ ${nombre}`);
    console.error(`   ${error instanceof Error ? error.message : error}`);
  }
}

comprobar("Clasifica cada página por lo que significa para la venta", () => {
  assert.strictEqual(clasificarRuta("/"), "inicio");
  assert.strictEqual(clasificarRuta("/shop"), "catalogo");
  assert.strictEqual(clasificarRuta("/categoria/ramo-de-flores"), "catalogo");
  assert.strictEqual(clasificarRuta("/producto/rosas-rojas-123"), "producto");
  assert.strictEqual(clasificarRuta("/checkout"), "checkout");
  assert.strictEqual(clasificarRuta("/contacto"), "contacto");
});

comprobar("No cuenta como visita lo que no es una página", () => {
  assert.strictEqual(clasificarRuta("/api/external/products"), null);
  assert.strictEqual(clasificarRuta("/assets/index-abc.js"), null);
  assert.strictEqual(clasificarRuta("/sitemap.xml"), null);
  assert.strictEqual(clasificarRuta("/uploads/foto.jpg"), null);
});

comprobar("Separa a los rastreadores de las personas", () => {
  registrarVisita("/", NAVEGADOR, false);
  registrarVisita("/", GOOGLEBOT, false);
  registrarVisita("/", "DIFIORI-Watchdog/1.0 (+monitoreo)", false);

  const r = obtenerResumen(7);
  assert.strictEqual(r.visitasDePersonas, 1, "solo una persona real");
  assert.strictEqual(r.visitasDeBots, 2, "el buscador y el vigilante no son clientes");
});

comprobar("Arma el embudo: entran, ven producto, llegan al pago", () => {
  for (let i = 0; i < 10; i += 1) registrarVisita("/", NAVEGADOR, false);
  for (let i = 0; i < 4; i += 1) registrarVisita(`/producto/ramo-${i}`, NAVEGADOR, false);
  registrarVisita("/checkout", NAVEGADOR, false);

  const { embudo } = obtenerResumen(7);
  assert.strictEqual(embudo.visitas, 15);
  assert.strictEqual(embudo.vieronProducto, 4);
  assert.strictEqual(embudo.llegaronAlPago, 1);
  assert.strictEqual(embudo.porcentajeQueVeProducto, 27);
  assert.strictEqual(embudo.porcentajeQueLlegaAlPago, 7);
});

comprobar("Dice qué productos se miran más", () => {
  for (let i = 0; i < 5; i += 1) registrarVisita("/producto/rosas-rojas-1", NAVEGADOR, false);
  registrarVisita("/producto/desayuno-2", NAVEGADOR, false);

  const { productosMasVistos } = obtenerResumen(7);
  assert.strictEqual(productosMasVistos[0].slug, "rosas-rojas-1");
  assert.strictEqual(productosMasVistos[0].vistas, 5);
});

comprobar("Sin visitas no inventa porcentajes", () => {
  const { embudo, visitasDePersonas } = obtenerResumen(7);
  assert.strictEqual(visitasDePersonas, 0);
  assert.strictEqual(embudo.porcentajeQueVeProducto, 0);
  assert.strictEqual(embudo.porcentajeQueLlegaAlPago, 0);
});

if (fallos > 0) {
  console.error(`\n${fallos} prueba(s) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nLa medición de visitas se comporta como se espera.");
}
