require("dotenv").config();
const { db: prisma } = require("../src/lib/prisma");

/**
 * Añade la posición manual de los productos.
 *
 * Se puede ejecutar varias veces sin romper nada: la columna y el índice solo se
 * crean si no existen. Los productos que ya estaban conservan su orden actual
 * (por fecha de creación) como punto de partida, para que el catálogo se vea
 * igual que antes hasta que alguien mueva algo desde el panel.
 */
async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "public"."products"
      ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "products_sortOrder_idx"
      ON "public"."products" ("sortOrder");
  `);

  // Punto de partida: el mismo orden que ya veían los clientes.
  const asignados = await prisma.$executeRawUnsafe(`
    WITH ordenados AS (
      SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" DESC) AS posicion
      FROM "public"."products"
      WHERE "sortOrder" IS NULL
    )
    UPDATE "public"."products" AS p
    SET "sortOrder" = o.posicion
    FROM ordenados AS o
    WHERE p."id" = o."id";
  `);

  console.log(`Columna lista. Productos con posición asignada: ${asignados}`);
}

main()
  .catch((error) => {
    console.error("No se pudo preparar la posición de los productos:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
