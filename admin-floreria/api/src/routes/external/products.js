const express = require('express');
const { db: prisma } = require('../../lib/prisma');

const router = express.Router();

/**
 * GET /api/external/products
 * Route pública para que la tienda pueda obtener productos activos.
 * No requiere autenticación de admin.
 */
router.get('/', async (req, res) => {
  try {
    const { category, featured } = req.query;
    const requestedLimit = Number.parseInt(String(req.query.limit || ''), 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 60))
      : undefined;

    const where = { isActive: true, isDeleted: false };
    if (category) where.category = category;
    if (featured === 'true') where.featured = true;

    const products = await prisma.product.findMany({
      where,
      include: {
        variants: {
          where: { isActive: true, isDeleted: false },
          select: {
            id: true,
            name: true,
            price: true,
            isDefault: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      // Los productos recién creados aparecen primero. Antes, los mismos
      // destacados ocupaban siempre las primeras posiciones del catálogo.
      orderBy: [{ createdAt: 'desc' }, { featured: 'desc' }],
      ...(limit ? { take: limit * 2 } : {}),
    });

    const data = products
      .slice(0, limit || products.length)
      .map((p) => {
      const defaultVariant = p.variants.find((v) => v.isDefault) || p.variants[0];
      const price = p.hasVariants ? defaultVariant?.price : p.price;

      // Calcular si es best seller (featured)
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: price ? `$${Number(price).toFixed(2)}` : '$0.00',
        rawPrice: price || 0,
        image: p.image || '',
        category: p.category,
        isBestSeller: p.featured,
        stock: p.stock,
        hasVariants: p.hasVariants,
        variants: p.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          isDefault: v.isDefault,
        })),
        deliveryTime: '2-3 horas',
        size: '-',
        includes: p.description || '',
      };
    });

    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    console.error('External products error:', error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

/**
 * GET /api/external/products/categories
 * Retorna la lista única de categorías activas para los filtros de la boutique.
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.product.findMany({
      where: { isActive: true, isDeleted: false },
      select: { name: true, description: true, category: true, price: true },
      distinct: ['category'],
    });

    const data = categories
      .map((c) => c.category)
      .filter((c) => c && c.trim() !== "");

    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    console.error('External categories error:', error);
    return res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});
/**
 * POST /api/external/products/seed
 * Endpoint temporal para ejecutar el seed de productos desde el navegador
 */
router.post('/seed', async (req, res) => {
  try {
    console.log('🌸 Ejecutando seed de productos Difiori...');

    // Importar Prisma dinámicamente
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();

    // Buscar o crear compañía Difiori
    let company = await db.company.findFirst({
      where: { slug: "difiori" }
    });

    if (!company) {
      company = await db.company.create({
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
    let adminUser = await db.users.findFirst({
      where: { email: "admin@difiori.com" }
    });

    if (!adminUser) {
      adminUser = await db.users.create({
        data: {
          email: "admin@difiori.com",
          name: "Admin Difiori",
          password: "admin123",
          role: "ADMIN",
          companyId: company.id,
          isActive: true,
        }
      });
      console.log("👤 Created admin user:", adminUser.email);
    }

    const DIFIORI_PRODUCTS = [
      {
        name: "Ramo de Rosas Rojas Premium",
        description: "Elegante ramo de 24 rosas rojas frescas de exportación, envueltas en papel decorativo y lazo de seda. Ideal para expresar amor profundo.",
        category: "Ramos de rosas",
        price: 45.00,
        image: "/assets/product1.png",
        featured: true,
        stock: 15,
        isActive: true,
        isDeleted: false,
        hasVariants: false,
        companyId: company.id,
        userId: adminUser.id,
      },
      {
        name: "Arreglo Primaveral Mixto",
        description: "Combinación vibrante de lirios, margaritas y claveles en tonos pasteles. Una explosión de frescura para cualquier ocasión.",
        category: "Flores mixtas",
        price: 38.00,
        image: "/assets/banner_collage.jpg",
        featured: true,
        stock: 12,
        isActive: true,
        isDeleted: false,
        hasVariants: false,
        companyId: company.id,
        userId: adminUser.id,
      },
      {
        name: "Cesta Sorpresa Gourmet",
        description: "Completo desayuno que incluye café premium, croissants recién horneados, ensalada de frutas frescas, jugo de naranja y un mini bouquet decorativo.",
        category: "Desayunos sorpresa",
        price: 55.00,
        image: "/assets/banner_collage.jpg",
        featured: true,
        stock: 8,
        isActive: true,
        isDeleted: false,
        hasVariants: false,
        companyId: company.id,
        userId: adminUser.id,
      },
      {
        name: "Caja de Rosas Bouquet Royal",
        description: "Caja de lujo con 12 rosas seleccionadas y follaje decorativo. Un regalo sofisticado y duradero.",
        category: "Amor y aniversario",
        price: 32.00,
        image: "/assets/banner_collage.jpg",
        featured: false,
        stock: 20,
        isActive: true,
        isDeleted: false,
        hasVariants: false,
        companyId: company.id,
        userId: adminUser.id,
      },
      {
        name: "Vino & Flores Selection",
        description: "Caja de regalo que incluye una botella de vino tinto Cabernet Sauvignon y un pequeño arreglo de flores complementario.",
        category: "Regalos con vino",
        price: 65.00,
        image: "/assets/banner_collage.jpg",
        featured: false,
        stock: 5,
        isActive: true,
        isDeleted: false,
        hasVariants: false,
        companyId: company.id,
        userId: adminUser.id,
      },
      {
        name: "Bouquet Cumpleaños Alegre",
        description: "Arreglo colorido con globos metalizados y flores mixtas. La mejor forma de desear un feliz día.",
        category: "Cumpleaños",
        price: 40.00,
        image: "/assets/banner_collage.jpg",
        featured: false,
        stock: 10,
        isActive: true,
        isDeleted: false,
        hasVariants: false,
        companyId: company.id,
        userId: adminUser.id,
      }
    ];

    let createdCount = 0;
    for (const productData of DIFIORI_PRODUCTS) {
      const existing = await db.product.findFirst({
        where: { name: productData.name }
      });

      if (!existing) {
        await db.product.create({
          data: productData
        });
        createdCount++;
        console.log(`✅ Created: ${productData.name}`);
      } else {
        console.log(`⏭️  Already exists: ${productData.name}`);
      }
    }

    await db.$disconnect();

    return res.status(200).json({
      status: 'success',
      message: `Seed ejecutado exitosamente. ${createdCount} productos creados.`,
      data: { createdCount }
    });

  } catch (error) {
    console.error('Seed error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error ejecutando el seed',
      error: error.message
    });
  }
});
module.exports = router;
