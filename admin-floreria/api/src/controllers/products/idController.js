const { db: prisma } = require("../../lib/prisma");
const { validateFeatureAccess } = require("../../validations/featureValidation");
const { ProductUpdateSchema } = require("../../validations/productSchema");
const { isDiscountActive } = require("../../utils/discountRules");

const variantSelect = {
  id: true,
  name: true,
  price: true,
  isActive: true,
  isDefault: true,
};

const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  image: true,
  category: true,
  stock: true,
  isActive: true,
  featured: true,
  hasVariants: true,
  createdAt: true,
  userId: true,
};

exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const hasAccessToFeature = await validateFeatureAccess('discounts', req.headers.host);
    // const hasAccessToFeature = null; // Deshabilitado temporalmente

    const product = await prisma.product.findUnique({
      where: { id, isDeleted: false },
      select: {
        ...productSelect,
        variants: {
          where: { isDeleted: false },
          select: variantSelect,
        },
        product_filters: {
          include: {
            category: true,
            option: true,
          },
        },
        discounts_products: {
          where: {
            discounts: {
              code: null,
            },
          },
          include: {
            discounts: true,
          },
        },
      },
    });
    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Producto no encontrado",
      });
    }

    const data = {
      ...product,
      discounts: hasAccessToFeature
        ? product.discounts_products
            .filter((dp) => isDiscountActive(dp.discounts))
            .map(dp => ({
              id: dp.discounts.id,
              percent: dp.discounts.percent,
              percent_value: Number(dp.discounts.percent_value),
              priority: dp.discounts.priority ?? 0,
              stackable: Boolean(dp.discounts.stackable),
            }))
        : [],
      discounts_products: undefined
    };

    return res.status(200).json({
      status: "success",
      message: "Producto obtenido",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { product, variants, productFilter, productFilters } = req.body;
    const { sortOrder, ...safeProductData } = product || {};

    // Obtener el producto original para preservar userId
    const originalProduct = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!originalProduct) {
      return res.status(404).json({
        status: "error",
        message: "Producto no encontrado",
      });
    }

    // Validación básica de payload producto si llega
    if (product) {
      const validation = ProductUpdateSchema.safeParse(safeProductData);
      if (!validation.success) {
        console.error("Validation error for product update:", validation.error.format());
        return res.status(400).json({
          status: "error",
          message: "Datos inválidos",
          details: validation.error.issues,
        });
      }
    }

    const res_product = await prisma.product.update({
      where: { id },
      data: safeProductData,
      select: productSelect,
    });

    if (res_product.hasVariants && variants && variants.length > 0) {
      await prisma.productVariant.deleteMany({
        where: { productId: res_product.id },
      });
      const newVariants = variants.map((variant) => ({
        name: variant.name,
        price: variant.price,
        isActive: variant.isActive ?? true,
        isDefault: variant.isDefault ?? false,
        productId: id,
        userId: originalProduct.userId, // Usar userId del producto original
      }));
      await prisma.productVariant.createMany({
        data: newVariants,
      });
    }

    // Actualizar relaciones product_filters si llega un arreglo o una sola
    const relations = productFilters || [];

    if (relations.length > 0) {
      // Estrategia: sincronizar. Borramos todas las relaciones del producto y reinsertamos las nuevas.
      await prisma.product_filters.deleteMany({
        where: { productId: res_product.id },
      });

      for (const rel of relations) {
        if (!rel || !rel.categoryId || !rel.optionId) continue;
        
        // const opt = await prisma.filter_options.findUnique({
        //   where: { id: rel.optionId },
        //   select: { id: true, categoryId: true },
        // });
        // if (!opt || opt.categoryId !== rel.categoryId) {
        //   return res.status(400).json({
        //     status: "error",
        //     message: "La opción no pertenece a la categoría seleccionada",
        //   });
        // }
        await prisma.product_filters.create({
          data: {
            productId: res_product.id,
            categoryId: rel.categoryId,
            optionId: rel.optionId,
          },
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Producto actualizado",
      data: { product: res_product },
    });
  } catch (error) {
    console.error("Update error:", error);
    return next(error);
  }
};

exports.deleteProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    // await prisma.product.delete({
    //   where: { id },
    // });
    await prisma.product.update({
      where: { id },
      data: { isDeleted: true },
    });

    return res.status(200).json({
      status: "success",
      message: "Producto eliminado",
    });
  } catch (error) {
    return next(error);
  }
};
