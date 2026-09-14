/**
 * Pruebas del guardado de productos. Se ejecutan con `node` a secas:
 * `node src/validations/productSchema.test.js`
 */

const assert = require("node:assert");
const {
  ProductCreateSchema,
  ProductUpdateSchema,
  limpiarCamposNoEditables,
} = require("./productSchema");

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

const productoValido = {
  name: "Ramo de rosas rojas",
  category: "Ramo de Flores",
  price: "45.00",
  stock: "12",
  isActive: true,
  featured: false,
  hasVariants: false,
};

probar("El stock escrito en el panel llega a la base de datos", () => {
  const r = ProductCreateSchema.safeParse(productoValido);
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.data.stock, 12, "el stock se perdía al validar y quedaba en 0");
});

probar("El precio se acepta como texto del formulario", () => {
  const r = ProductCreateSchema.safeParse(productoValido);
  assert.strictEqual(r.data.price, 45);
});

probar("Un producto sin nombre o sin categoría se rechaza con el motivo", () => {
  const sinNombre = ProductCreateSchema.safeParse({ ...productoValido, name: "" });
  assert.strictEqual(sinNombre.success, false);
  assert.match(sinNombre.error.issues[0].message, /nombre/i);

  const sinCategoria = ProductCreateSchema.safeParse({ ...productoValido, category: "" });
  assert.strictEqual(sinCategoria.success, false);
});

probar("Un stock negativo se rechaza", () => {
  const r = ProductCreateSchema.safeParse({ ...productoValido, stock: -5 });
  assert.strictEqual(r.success, false);
});

probar("Editar NO puede cambiar la fecha de creación", () => {
  const delFormulario = {
    ...productoValido,
    id: "abc123",
    createdAt: "2026-09-13T10:00:00.000Z",
    userId: "usuario-del-panel",
    companyId: "otra-empresa",
  };

  const limpio = limpiarCamposNoEditables(delFormulario);

  assert.strictEqual(limpio.createdAt, undefined, "editar movía el producto al primer puesto");
  assert.strictEqual(limpio.id, undefined);
  assert.strictEqual(limpio.userId, undefined);
  assert.strictEqual(limpio.companyId, undefined);
  assert.strictEqual(limpio.name, "Ramo de rosas rojas", "los datos reales se conservan");
});

probar("Al editar se pueden enviar solo los campos que cambian", () => {
  const r = ProductUpdateSchema.safeParse({ price: "50" });
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.data.price, 50);
});

probar("Lo validado tampoco arrastra campos prohibidos", () => {
  const r = ProductUpdateSchema.safeParse(limpiarCamposNoEditables({ ...productoValido, createdAt: "2020-01-01" }));
  assert.strictEqual(r.success, true);
  assert.strictEqual(limpiarCamposNoEditables(r.data).createdAt, undefined);
});

if (fallos > 0) {
  console.error(`\n${fallos} prueba(s) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("\nEl guardado de productos se comporta como se espera.");
}
