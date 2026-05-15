const express = require("express");
const { db: prisma } = require("../../lib/prisma");
const { resolvePublicMediaUrl } = require("../../utils/publicMediaUrl");
const {
  normalizeStorefrontItems,
  hydrateStorefrontItems,
} = require("../../utils/storefrontCartItems");
const { businessLog, businessError } = require("../../utils/logger");

const router = express.Router();

async function getCompanyForAdmin(adminId) {
  if (!adminId) return null;

  return prisma.company.findFirst({
    where: {
      users: {
        some: {
          id: adminId,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
}

router.get("/", async (req, res) => {
  try {
    const company = await getCompanyForAdmin(req.user?.adminId);
    if (!company) {
      return res.status(404).json({
        status: "error",
        message: "Empresa no encontrada para este usuario.",
      });
    }

    const { status, search } = req.query;
    const where = {
      companyId: company.id,
    };

    if (status && status !== "ALL") {
      where.status = String(status);
    }

    if (search) {
      where.OR = [
        { customerName: { contains: String(search), mode: "insensitive" } },
        { customerPhone: { contains: String(search), mode: "insensitive" } },
        { senderName: { contains: String(search), mode: "insensitive" } },
        { receiverName: { contains: String(search), mode: "insensitive" } },
        { exactAddress: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const carts = await prisma.abandonedCart.findMany({
      where,
      orderBy: [
        { abandonedAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    const normalizedCarts = await Promise.all(
      carts.map(async (cart) => {
        const normalizedItems = normalizeStorefrontItems(Array.isArray(cart.items) ? cart.items : []);
        const hydratedItems = await hydrateStorefrontItems(prisma, normalizedItems);

        return {
          ...cart,
          items: hydratedItems.map((item) => ({
            ...item,
            name: item.productName || "Producto DIFIORI",
            image: resolvePublicMediaUrl(item.productImage || item.image) || item.productImage || item.image || null,
            productImage:
              resolvePublicMediaUrl(item.productImage || item.image) ||
              item.productImage ||
              item.image ||
              null,
          })),
        };
      })
    );

    return res.json({
      status: "success",
      data: normalizedCarts,
    });
  } catch (error) {
    console.error("Get abandoned carts error:", error);
    return res.status(500).json({
      status: "error",
      message: "No se pudieron cargar los carritos abandonados.",
    });
  }
});

router.patch("/:id", async (req, res) => {
  const startedAt = Date.now();
  try {
    const company = await getCompanyForAdmin(req.user?.adminId);
    if (!company) {
      return res.status(404).json({
        status: "error",
        message: "Empresa no encontrada para este usuario.",
      });
    }

    const { id } = req.params;
    const { status, notes } = req.body || {};
    const allowedStatuses = ["NEW", "CONTACTED", "RECOVERED", "CLOSED"];

    if (status && !allowedStatuses.includes(String(status))) {
      return res.status(400).json({
        status: "error",
        message: "Estado no permitido.",
      });
    }

    const existing = await prisma.abandonedCart.findFirst({
      where: {
        id,
        companyId: company.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        status: "error",
        message: "Carrito abandonado no encontrado.",
      });
    }

    const data = {
      notes: typeof notes === "string" ? notes.trim() : existing.notes,
    };

    if (status) {
      data.status = String(status);
      if (status === "CONTACTED" && !existing.contactedAt) {
        data.contactedAt = new Date();
      }
      if (status === "RECOVERED") {
        data.recoveredAt = new Date();
      }
    }

    const updated = await prisma.abandonedCart.update({
      where: { id: existing.id },
      data,
    });

    if (status && status !== existing.status) {
      businessLog("CART", "STATUS_CHANGED", {
        cartId: updated.id,
        customerName: updated.customerName,
        phone: updated.customerPhone,
        from: existing.status,
        to: updated.status,
        total: Number(updated.total || 0),
        adminId: req.user?.adminId || null,
        durationMs: Date.now() - startedAt,
      });
    }

    if (typeof notes === "string" && notes.trim() !== String(existing.notes || "")) {
      businessLog("CART", "NOTES_UPDATED", {
        cartId: updated.id,
        customerName: updated.customerName,
        phone: updated.customerPhone,
        status: updated.status,
        adminId: req.user?.adminId || null,
        durationMs: Date.now() - startedAt,
      });
    }

    return res.json({
      status: "success",
      data: updated,
    });
  } catch (error) {
    businessError("CART", "UPDATE_FAILED", error, {
      cartId: req.params?.id,
      adminId: req.user?.adminId || null,
      durationMs: Date.now() - startedAt,
    });
    console.error("Update abandoned cart error:", error);
    return res.status(500).json({
      status: "error",
      message: "No se pudo actualizar el carrito abandonado.",
    });
  }
});

module.exports = router;
