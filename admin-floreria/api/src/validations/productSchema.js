const { z } = require("zod");

const ProductCreateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  image: z.string().optional(),
  category: z.string().min(1, "La categoría es requerida"),
  price: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0").optional(),
  // Sin esto, el stock escrito en el panel se descartaba al validar y todos los
  // productos quedaban con existencia 0.
  stock: z.coerce.number().int().min(0, "El stock no puede ser negativo").optional(),
  isActive: z.boolean().default(true),
  featured: z.boolean().default(false),
  hasVariants: z.boolean().default(false),
  userId: z.string().optional(), // Hacer opcional para que el controlador lo maneje
});

const ProductUpdateSchema = ProductCreateSchema.partial().extend({
  id: z.string().optional(),
});

const ProductVariantSchema = z.object({
  name: z.string().min(1, "El nombre de la variante es requerido"),
  price: z.number().min(0, "El precio debe ser mayor o igual a 0"),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

/**
 * Campos que nunca deben llegar desde el formulario: los gestiona la base de
 * datos o el servidor. El panel enviaba `createdAt` en cada guardado y, como el
 * catálogo se ordena por fecha, editar un producto lo mandaba al primer puesto
 * de la tienda sin que nadie lo hubiera pedido.
 */
const CAMPOS_NO_EDITABLES = ["id", "createdAt", "updatedAt", "companyId", "userId"];

function limpiarCamposNoEditables(datos = {}) {
  const copia = { ...datos };
  for (const campo of CAMPOS_NO_EDITABLES) delete copia[campo];
  return copia;
}

module.exports = {
  CAMPOS_NO_EDITABLES,
  limpiarCamposNoEditables,
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductVariantSchema,
};
