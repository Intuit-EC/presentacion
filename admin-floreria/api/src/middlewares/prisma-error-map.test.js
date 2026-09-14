/**
 * Pruebas de los mensajes de error de base de datos: lo que ve el administrador
 * cuando algo falla. Se ejecuta con `node src/middlewares/prisma-error-map.test.js`.
 */

const assert = require("node:assert");
const { mapearErrorPrisma } = require("./prisma-error-map");

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

probar("Falta una columna: dice que hay que migrar, no 'error de base'", () => {
  const r = mapearErrorPrisma("P2022", { column: "products.sortOrder" });

  assert.strictEqual(r.status, 500);
  assert.match(r.message, /migraci/i, "el mensaje debe decir qué hacer");
  assert.strictEqual(r.code, "P2022");
  assert.deepStrictEqual(r.details, { column: "products.sortOrder" });
});

probar("Falta una tabla: también lo explica", () => {
  const r = mapearErrorPrisma("P2021", { table: "products" });
  assert.strictEqual(r.status, 500);
  assert.match(r.message, /tabla/i);
});

probar("Un error desconocido al menos trae su código", () => {
  const r = mapearErrorPrisma("P2037");
  assert.match(r.message, /P2037/, "sin el código no hay forma de investigar");
  assert.strictEqual(r.status, 500);
});

probar("Dato obligatorio faltante: es culpa del formulario, no del servidor", () => {
  const r = mapearErrorPrisma("P2011", { constraint: "name" });
  assert.strictEqual(r.status, 400);
});

probar("Los casos que ya funcionaban siguen igual", () => {
  assert.strictEqual(mapearErrorPrisma("P2002").status, 409);
  assert.strictEqual(mapearErrorPrisma("P2003").status, 409);
  assert.strictEqual(mapearErrorPrisma("P2025").status, 404);
  assert.strictEqual(mapearErrorPrisma("P2014").status, 400);
  assert.strictEqual(mapearErrorPrisma("P2000").status, 400);
});

probar("Sin detalle extra no inventa un campo vacío", () => {
  assert.strictEqual(mapearErrorPrisma("P2002").details, undefined);
});

if (fallos > 0) {
  console.error(`\n${fallos} prueba(s) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nLos errores de base de datos se explican correctamente.");
}
