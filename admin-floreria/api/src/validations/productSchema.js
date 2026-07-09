const { z } = require("zod");

const ProductCreateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  image: z.string().optional(),
  category: z.string().min(1, "La categoría es requerida"),
  price: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0").optional(),
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

module.exports = {
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductVariantSchema,
};
