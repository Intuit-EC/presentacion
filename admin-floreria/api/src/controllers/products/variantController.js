const { db: prisma } = require("../../lib/prisma");

const variantSelect = {
  id: true,
  productId: true,
  name: true,
  price: true,
  isActive: true,
  isDefault: true,
};

exports.getVariantsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      select: variantSelect,
    });
    return res.status(200).json({ variants });
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener variantes' });
  }
};

exports.createVariant = async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, price, isActive, isDefault } = req.body;
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name,
        price,
        isActive,
        isDefault
      },
      select: variantSelect,
    });
    return res.status(201).json({ variant });
  } catch (error) {
    return res.status(500).json({ error: 'Error al crear variante' });
  }
};

exports.updateVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { sortOrder, ...data } = req.body || {};
    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data,
      select: variantSelect,
    });
    return res.status(200).json({ variant });
  } catch (error) {
    return res.status(500).json({ error: 'Error al actualizar variante' });
  }
};

exports.deleteVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    await prisma.productVariant.delete({
      where: { id: variantId }
    });
    return res.status(200).json({ message: 'Variante eliminada' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar variante' });
  }
};
