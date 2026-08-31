const { db: prisma } = require("../lib/prisma");

/**
 * Pulso de ventas: las cifras que responden "¿se está vendiendo ahora mismo?".
 *
 * Vive aquí y no dentro del vigilante porque lo usan dos consumidores: el script
 * que corre en el servidor y el endpoint que permite vigilar las ventas desde
 * fuera, sin dar acceso a la base de datos.
 */

const PAGADAS = ["PAID", "SUCCEEDED"];
const FALLIDAS = ["FAILED", "CANCELLED"];
const SEMANAS_HISTORICO = 4;

function ahoraLocal() {
  const desfaseMinutos = Number(process.env.WATCHDOG_UTC_OFFSET_MINUTES || -300);
  return new Date(Date.now() + desfaseMinutos * 60_000);
}

function inicioDelDia(fecha) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function restarDias(fecha, dias) {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() - dias);
  return copia;
}

function contarPedidos(desde, hasta, filtroExtra = {}) {
  return prisma.order.count({
    where: { createdAt: { gte: desde, lt: hasta }, ...filtroExtra },
  });
}

/**
 * Cuántos pedidos suele haber a esta misma hora, mirando el mismo día de la
 * semana en las semanas anteriores. Sin esa referencia, "cero ventas" un martes
 * a mediodía y un domingo a las 7 de la mañana parecerían el mismo problema.
 */
async function pedidosEsperadosAEstaHora(ahora) {
  const muestras = [];

  for (let semana = 1; semana <= SEMANAS_HISTORICO; semana += 1) {
    const dia = restarDias(ahora, semana * 7);
    const desde = inicioDelDia(dia);
    const hasta = new Date(desde);
    hasta.setHours(ahora.getHours(), ahora.getMinutes(), 0, 0);

    muestras.push(await contarPedidos(desde, hasta));
  }

  const media = muestras.reduce((suma, valor) => suma + valor, 0) / muestras.length;
  return { media, muestras };
}

async function obtenerPulsoDeVentas({ horasVentana = 5, horaInicio = 8, horaFin = 20 } = {}) {
  const ahora = ahoraLocal();
  const inicioHoy = inicioDelDia(ahora);
  const haceUnaHora = new Date(ahora.getTime() - 3_600_000);
  const inicioVentana = new Date(ahora.getTime() - horasVentana * 3_600_000);

  const [
    pedidosHoy,
    pedidosUltimaHora,
    pedidosEnVentana,
    pagadasHoy,
    fallidasHoy,
    pendientesHoy,
    abandonadosHoy,
    ingresos,
    ticket,
    empresa,
    productosActivos,
    ultimoPedido,
  ] = await Promise.all([
    contarPedidos(inicioHoy, ahora),
    contarPedidos(haceUnaHora, ahora),
    contarPedidos(inicioVentana, ahora),
    contarPedidos(inicioHoy, ahora, { paymentStatus: { in: PAGADAS } }),
    contarPedidos(inicioHoy, ahora, { paymentStatus: { in: FALLIDAS } }),
    contarPedidos(inicioHoy, ahora, { paymentStatus: "PENDING" }),
    prisma.abandonedCart.count({ where: { createdAt: { gte: inicioHoy, lt: ahora } } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { createdAt: { gte: inicioHoy, lt: ahora }, paymentStatus: { in: PAGADAS } },
    }),
    prisma.order.aggregate({
      _avg: { total: true },
      where: { createdAt: { gte: inicioHoy, lt: ahora }, paymentStatus: { in: PAGADAS } },
    }),
    prisma.company.findFirst({
      where: { isActive: true },
      select: { settings: true, email: true, name: true },
    }),
    prisma.product.count({ where: { isActive: true } }).catch(() => null),
    prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, paymentStatus: true, total: true },
    }),
  ]);

  const pendientesEstancados = await prisma.order.count({
    where: {
      paymentStatus: "PENDING",
      createdAt: { gte: restarDias(ahora, 2), lt: new Date(ahora.getTime() - 2 * 3_600_000) },
    },
  });

  const sinComprobante = await prisma.order
    .count({
      where: {
        paymentStatus: "PENDING",
        paymentProofImageUrl: null,
        createdAt: { gte: inicioHoy, lt: new Date(ahora.getTime() - 3_600_000) },
        OR: [{ orderNotes: { contains: "Banco" } }, { orderNotes: { contains: "Zelle" } }],
      },
    })
    .catch(() => null);

  const pedidosDelDia = await prisma.order.findMany({
    where: { createdAt: { gte: inicioHoy, lt: ahora } },
    select: { customerEmail: true, customerPhone: true },
  });
  const clientesUnicos = new Set(
    pedidosDelDia
      .map((pedido) => (pedido.customerEmail || pedido.customerPhone || "").trim().toLowerCase())
      .filter(Boolean),
  ).size;

  const historico = await pedidosEsperadosAEstaHora(ahora);
  const horasDesdeUltimaVenta = ultimoPedido
    ? Number(((ahora.getTime() - new Date(ultimoPedido.createdAt).getTime()) / 3_600_000).toFixed(1))
    : null;

  return {
    momento: ahora.toISOString(),
    horaLocal: ahora.getHours(),
    enHorarioComercial: ahora.getHours() >= horaInicio && ahora.getHours() < horaFin,
    pedidosHoy,
    pedidosUltimaHora,
    pedidosEnVentana,
    ventanaHoras: horasVentana,
    pagadasHoy,
    fallidasHoy,
    pendientesHoy,
    pendientesEstancados,
    sinComprobante,
    abandonadosHoy,
    clientesUnicos,
    ingresosHoy: Number(ingresos?._sum?.total || 0),
    ticketMedio: Number(ticket?._avg?.total || 0),
    esperadoAEstaHora: historico.media,
    historicoMuestras: historico.muestras,
    horasDesdeUltimaVenta,
    aceptaPedidos: empresa?.settings?.acceptOrders !== false,
    productosActivos,
    empresa: empresa?.name || "DIFIORI",
    correoEmpresa: empresa?.email || null,
  };
}

module.exports = { obtenerPulsoDeVentas, SEMANAS_HISTORICO };
