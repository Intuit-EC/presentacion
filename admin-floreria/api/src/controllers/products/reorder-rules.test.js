/**
 * Pruebas del reordenamiento del catálogo. Se ejecutan con `node` a secas, sin
 * base de datos: `node src/controllers/products/reorder-rules.test.js`.
 */

const assert = require("node:assert");
const { validarListaDeOrden, calcularPosiciones } = require("./reorder-rules");

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

probar("Acepta una lista normal de productos", () => {
  const r = validarListaDeOrden(["a", "b", "c"]);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.ids, ["a", "b", "c"]);
});

probar("Rechaza una lista vacía o que no es lista", () => {
  assert.strictEqual(validarListaDeOrden([]).ok, false);
  assert.strictEqual(validarListaDeOrden(null).ok, false);
  assert.strictEqual(validarListaDeOrden("a,b").ok, false);
  assert.strictEqual(validarListaDeOrden(undefined).estado, 400);
});

probar("Rechaza productos repetidos: dos posiciones para el mismo producto", () => {
  const r = validarListaDeOrden(["a", "b", "a"]);
  assert.strictEqual(r.ok, false);
  assert.match(r.mensaje, /repetidos/);
});

probar("Limpia espacios y descarta entradas vacías", () => {
  const r = validarListaDeOrden([" a ", "", "  ", "b"]);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.ids, ["a", "b"]);
});

probar("Rechaza listas desproporcionadas", () => {
  const enorme = Array.from({ length: 501 }, (_, i) => `id-${i}`);
  const r = validarListaDeOrden(enorme);
  assert.strictEqual(r.ok, false);
  assert.match(r.mensaje, /máximo/);
});

probar("Las posiciones empiezan en 1, no en 0", () => {
  const posiciones = calcularPosiciones(["a", "b", "c"], ["a", "b", "c"]);
  assert.deepStrictEqual(posiciones, [
    { id: "a", sortOrder: 1 },
    { id: "b", sortOrder: 2 },
    { id: "c", sortOrder: 3 },
  ]);
});

probar("Ignora productos que ya no existen y no deja huecos", () => {
  const posiciones = calcularPosiciones(["a", "borrado", "b"], ["a", "b"]);
  assert.deepStrictEqual(posiciones, [
    { id: "a", sortOrder: 1 },
    { id: "b", sortOrder: 2 },
  ]);
});

probar("Si nada de la lista existe, no devuelve posiciones", () => {
  assert.deepStrictEqual(calcularPosiciones(["x", "y"], ["a"]), []);
});

probar("Mover un producto al principio reordena todo el resto", () => {
  const catalogo = ["a", "b", "c", "d"];
  const movido = ["c", "a", "b", "d"];
  const posiciones = calcularPosiciones(movido, catalogo);

  assert.strictEqual(posiciones.find((p) => p.id === "c").sortOrder, 1);
  assert.strictEqual(posiciones.find((p) => p.id === "a").sortOrder, 2);
  assert.strictEqual(posiciones.find((p) => p.id === "d").sortOrder, 4);
});

if (fallos > 0) {
  console.error(`\n${fallos} prueba(s) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nEl reordenamiento se comporta como se espera.");
}
