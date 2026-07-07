const { getTenantIdByDomain, getAvailableFeatures } = require("../../../prisma/prisma-service");
const { db: prisma } = require("../../lib/prisma");
const { extractTenantDomain } = require("../../middlewares/featureMiddleware");
const { validateFeatureAccess } = require("../../validations/featureValidation");
const { ProductCreateSchema } = require("../../validations/productSchema");
const { isDiscountActive } = require("../../utils/discountRules");

exports.getProductsFeatured = async (req, res, next) => {
  try {
    const hasAccessToFeature = await validateFeatureAccess('discounts', req.headers.host);
    // const hasAccessToFeature = null; // Deshabilitado temporalmente

    const products = await prisma.product.findMany({
      where: { isActive: true, featured: true },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
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
      orderBy: [{ createdAt: "desc" }],
      take: 3,
    });

    const productsData = products.map(product => ({
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
    }));

    const data = productsData.map((product) => {
      const variants = product.variants || []; // Asegurarse de que variants no sea undefined
      const def = variants.find((v) => v.isDefault) || variants[0]; // Variante por defecto o la primera
      let priceRange = null;
      if (variants.length > 1) {
        const prices = variants.map((v) => v.price); // Obtener todos los precios
        priceRange = { min: Math.min(...prices), max: Math.max(...prices) };
      }
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.hasVariants ? def?.price || 0 : product.price || 0,
        image: product.image,
        category: product.category,
        hasVariants: product.hasVariants,
        priceRange,
        discounts: product.discounts,
      };
    });

    return res.status(200).json({
      status: "success",
      message: "Productos destacados obtenidos",
      data,
    });
  } catch (error) {
    console.error("Get featured products error:", error);
    return next(error);
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category;
    const search = req.query.search;
    const isActive = req.query.isActive;

    const hasAccessToFeature = await validateFeatureAccess('discounts', req.headers.host);

    const where = {};

    where.isDeleted = false; // Excluir productos eliminados

    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    // if (isActive !== undefined) {
    //   where.isActive = isActive === 'true';
    // }

    // const [products, total] = await Promise.all([
    //   prisma.product.findMany({
    //     where,
    //     skip: (page - 1) * limit,
    //     take: limit,
    //     include: {
    //       variants: {
    //         orderBy: { sortOrder: 'asc' }
    //       }
    //     },
    //     orderBy: { createdAt: 'desc' },
    //   }),
    //   prisma.product.count({ where }),
    // ]);

    const products = await prisma.product.findMany({
      where,
      include: {
        variants: {
          where: { isDeleted: false },
          orderBy: { sortOrder: "asc" },
        },
        discounts_products: {
          include: {
            discounts: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
    });

    // return res.status(200).json({
    //   status: "success",
    //   message: "Productos obtenidos",
    //   data: {
    //     products,
    //     pagination: {
    //       page,
    //       limit,
    //       total,
    //       pages: Math.ceil(total / limit),
    //     }
    //   }
    // });
    const data = products.map(p => ({
      ...p,
      discounts: hasAccessToFeature
        ? p.discounts_products
            .filter((dp) => isDiscountActive(dp.discounts) && dp.discounts.is_active)
            .map(dp => ({
              id: dp.discounts.id,
              percent: dp.discounts.percent,
              percent_value: Number(dp.discounts.percent_value),
              priority: dp.discounts.priority ?? 0,
              stackable: Boolean(dp.discounts.stackable),
            }))
        : [],
      discounts_products: undefined
    }));
    return res.status(200).json({
      status: "success",
      message: "Productos obtenidos",
      data,
    });
  } catch (error) {
    console.error("Get products error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor",
    });
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const { variants, productFilter, productFilters, product } = req.body;

    // Validar datos del producto
    const validation = ProductCreateSchema.safeParse(product);
    if (!validation.success) {
      return res.status(400).json({
        status: "error",
        message: "Datos inválidos",
        details: validation.error.issues,
      });
    }

    // Validar variantes si el producto las tiene
    if (product.hasVariants) {
      if (!variants || variants.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "El producto debe tener al menos una variante",
        });
      }
      // Verificar que hay exactamente una variante por defecto
      const defaultVariants = variants.filter((v) => v.isDefault);
      if (defaultVariants.length !== 1) {
        return res.status(400).json({
          status: "error",
          message:
            "Debe haber exactamente una variante marcada como predeterminada",
        });
      }
    }
    console.log("Creating product with data:", validation.data);
    // Crear producto con variantes en una transacción
    const productResponse = await prisma.$transaction(async (tx) => {
      // Buscar o crear compañía DIFIORI
      let company = await tx.company.findFirst({
        where: { slug: "difiori" }
      });

      if (!company) {
        company = await tx.company.create({
          data: {
            name: "Difiori Floristería",
            slug: "difiori",
            email: "ventas@difiori.com.ec",
            phone: "+593 99 798 4583",
            isActive: true,
            isSetup: true,
          }
        });
        console.log("🏢 Created company:", company.name);
      }

      // Buscar o crear usuario admin
      let adminUser = await tx.users.findFirst({
        where: { email: "admin@difiori.com" }
      });

      if (!adminUser) {
        adminUser = await tx.users.create({
          data: {
            email: "admin@difiori.com",
            name: "Admin Difiori",
            password: "admin123", // Esto debería ser hasheado en producción
            role: "ADMIN",
            companyId: company.id,
            isActive: true,
          }
        });
        console.log("👤 Created admin user:", adminUser.email);
      }

      // Usar userId del body o el admin creado
      const userId = validation.data.userId || adminUser.id;

      // Crear el producto
      const newProduct = await tx.product.create({
        data: { 
          ...validation.data, 
          userId,
          companyId: company.id,
          isLimited: false,
          priceIncludesTax: true,
        },
      });

      // Crear variantes si las hay
      if (product.hasVariants && variants && variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants.map((variant, index) => ({
            productId: newProduct.id,
            name: variant.name,
            price: variant.price,
            isDefault: variant.isDefault,
            sortOrder: variant.sortOrder || index,
            isActive: true,
            userId: validation.data.userId, // Agregar userId requerido
          })),
        });
      }

      // Crear relación(es) en product_filters si se enviaron
      const filtersToCreate = productFilters || [];

      if (filtersToCreate.length > 0) {
        // Validar cada opción y crear la relación
        for (const pf of filtersToCreate) {
          if (!pf || !pf.categoryId || !pf.optionId) continue;

          // const opt = await tx.filter_options.findUnique({
          //   where: { id: pf.optionId },
          //   select: { id: true, categoryId: true },
          // });
          // if (!opt || opt.categoryId !== pf.categoryId) {
          //   throw new Error(
          //     `La opción ${pf.optionId} no pertenece a la categoría ${pf.categoryId}`
          //   );
          // }

          await tx.product_filters.create({
            data: {
              productId: newProduct.id,
              categoryId: pf.categoryId,
              optionId: pf.optionId,
            },
          });
        }
      }

      // Retornar producto con variantes
      return await tx.product.findUnique({
        where: { id: newProduct.id },
        include: {
          variants: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });
    });

    return res.status(201).json({
      status: "success",
      message: "Producto creado",
      data: { product: productResponse },
    });
  } catch (error) {
    console.error("Create product error:", error);
    return next(error);
  }
};

exports.getProductFilters = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const productFilters = await prisma.product_filters.findMany({
      where: { productId },
    });
    return res.status(200).json({
      status: "success",
      message: "Product filters obtained",
      data: productFilters,
    });
  } catch (error) {
    console.error("Get product filters error:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor",
    });
  }
};
