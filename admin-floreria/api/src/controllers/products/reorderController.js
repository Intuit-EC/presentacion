const { db: prisma } = require("../../lib/prisma");
const { businessLog, businessError } = require("../../utils/logger");
const { validarListaDeOrden, calcularPosiciones } = require("./reorder-rules");

/**
 * PUT /api/products/reorder
 *
 * Guarda la posición de los productos elegida desde el panel. Antes el orden
 * vivía solo en el navegador del administrador: no se veía en la tienda, no lo
 * compartían dos administradores y se perdía al cambiar de equipo.
 *
 * Recibe { productIds: [...] } en el orden deseado. Se aceptan listas parciales
 * (por ejemplo, solo la categoría que se está acomodando): los productos que no
 * vengan en la lista conservan la posición que tenían.
 */
exports.reorderProducts = async (req, res) => {
  const validacion = validarListaDeOrden(req.body?.productIds);
  if (!validacion.ok) {
    return res.status(validacion.estado).json({ status: "error", message: validacion.mensaje });
  }

  const idsUnicos = validacion.ids;

  try {
    // Solo se mueven productos que existen y son de esta empresa: así una lista
    // manipulada no puede tocar el catálogo de otro.
    const existentes = await prisma.product.findMany({
      where: { id: { in: idsUnicos }, isDeleted: false },
      select: { id: true },
    });
    const posiciones = calcularPosiciones(
      idsUnicos,
      existentes.map((producto) => producto.id),
    );

    if (posiciones.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Ninguno de los productos enviados existe.",
      });
    }

    await prisma.$transaction(
      posiciones.map(({ id, sortOrder }) =>
        prisma.product.update({ where: { id }, data: { sortOrder } }),
      ),
    );

    businessLog("CATALOGO", "REORDENADO", {
      productosMovidos: posiciones.length,
      ignorados: idsUnicos.length - posiciones.length,
    });

    return res.status(200).json({
      status: "success",
      message: "Orden del catálogo actualizado.",
      data: { actualizados: posiciones.length, ignorados: idsUnicos.length - posiciones.length },
    });
  } catch (error) {
    businessError("CATALOGO", "REORDEN_FALLIDO", error, { total: idsUnicos.length });
    return res.status(500).json({
      status: "error",
      message: "No se pudo guardar el nuevo orden.",
    });
  }
};

/**
 * DELETE /api/products/reorder
 * Devuelve el catálogo al orden automático (lo más nuevo primero).
 */
exports.resetProductOrder = async (_req, res) => {
  try {
    const { count } = await prisma.product.updateMany({
      where: { sortOrder: { not: null } },
      data: { sortOrder: null },
    });

    businessLog("CATALOGO", "ORDEN_RESTABLECIDO", { productos: count });

    return res.status(200).json({
      status: "success",
      message: "El catálogo volvió al orden automático.",
      data: { productos: count },
    });
  } catch (error) {
    businessError("CATALOGO", "RESET_ORDEN_FALLIDO", error, {});
    return res.status(500).json({
      status: "error",
      message: "No se pudo restablecer el orden.",
    });
  }
};
