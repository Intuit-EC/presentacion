#!/usr/bin/env node
/**
 * Vigilante de ventas DIFIORI.
 *
 * Se ejecuta cada pocos minutos y responde a una sola pregunta: ¿se está
 * vendiendo con normalidad ahora mismo? Compara lo que va del día contra lo que
 * suele ocurrir el mismo día de la semana a la misma hora, revisa que los cobros
 * se completen y avisa por correo cuando algo se sale de lo normal.
 *
 * Uso:
 *   node scripts/sales-watchdog.js            # revisión normal
 *   node scripts/sales-watchdog.js --json     # solo imprime métricas (sin avisos)
 *   node scripts/sales-watchdog.js --dry-run  # evalúa y muestra avisos, no envía correo
 *   node scripts/sales-watchdog.js --resumen  # envía el resumen del día
 *
 * Variables de entorno (todas opcionales, con valores por defecto sensatos):
 *   WATCHDOG_ALERT_EMAIL     destinatario de los avisos (por defecto COMPANY_EMAIL)
 *   WATCHDOG_HORAS_SIN_VENTA horas sin una sola venta que disparan aviso (5)
 *   WATCHDOG_HORA_INICIO     hora a la que abre el negocio (8)
 *   WATCHDOG_HORA_FIN        hora a la que cierra (20)
 *   WATCHDOG_CAIDA_PCT       % de la media esperada por debajo del cual se avisa (40)
 *   WATCHDOG_COOLDOWN_HORAS  horas antes de repetir el mismo aviso (3)
 */

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const { db: prisma } = require("../src/lib/prisma");
const { getSmtpConfig, getDefaultFrom } = require("../src/utils/smtpConfig");
const { businessLog, businessError } = require("../src/utils/logger");
const { evaluarAvisos, dinero, SEMANAS_HISTORICO } = require("./sales-watchdog-rules");

const ARGS = new Set(process.argv.slice(2));
const SOLO_JSON = ARGS.has("--json");
const SIN_ENVIAR = ARGS.has("--dry-run");
const RESUMEN_DIARIO = ARGS.has("--resumen");

const HORAS_SIN_VENTA = Number(process.env.WATCHDOG_HORAS_SIN_VENTA || 5);
const HORA_INICIO = Number(process.env.WATCHDOG_HORA_INICIO || 8);
const HORA_FIN = Number(process.env.WATCHDOG_HORA_FIN || 20);
const CAIDA_PCT = Number(process.env.WATCHDOG_CAIDA_PCT || 40);
const COOLDOWN_HORAS = Number(process.env.WATCHDOG_COOLDOWN_HORAS || 3);
const ESTADO_PATH = path.join(__dirname, "..", "logs", "sales-watchdog-state.json");

const PAGADAS = ["PAID", "SUCCEEDED"];
const FALLIDAS = ["FAILED", "CANCELLED"];

/** Fecha local de Guayaquil (UTC-5) para que "hoy" signifique lo mismo que en el negocio. */
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

function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(ESTADO_PATH, "utf8"));
  } catch {
    return { avisos: {} };
  }
}

function guardarEstado(estado) {
  try {
    fs.mkdirSync(path.dirname(ESTADO_PATH), { recursive: true });
    fs.writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2));
  } catch (error) {
    businessError("WATCHDOG", "STATE_WRITE_FAILED", error, { path: ESTADO_PATH });
  }
}

function enSilencio(estado, clave) {
  const ultimo = estado.avisos?.[clave];
  if (!ultimo) return false;
  return Date.now() - new Date(ultimo).getTime() < COOLDOWN_HORAS * 3_600_000;
}

async function contarPedidos(desde, hasta, filtroExtra = {}) {
  return prisma.order.count({
    where: { createdAt: { gte: desde, lt: hasta }, ...filtroExtra },
  });
}

/**
 * Cuántos pedidos suele haber a esta misma hora, mirando el mismo día de la
 * semana en las semanas anteriores. Sin esta referencia, "0 ventas" un martes
 * por la mañana y "0 ventas" un domingo a las 7am parecerían el mismo problema.
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

  if (muestras.length === 0) return { media: null, muestras };

  const media = muestras.reduce((suma, valor) => suma + valor, 0) / muestras.length;
  return { media, muestras };
}

async function recogerMetricas() {
  const ahora = ahoraLocal();
  const inicioHoy = inicioDelDia(ahora);
  const haceUnaHora = new Date(ahora.getTime() - 3_600_000);
  const ventanaSinVenta = new Date(ahora.getTime() - HORAS_SIN_VENTA * 3_600_000);

  const [
    pedidosHoy,
    pedidosUltimaHora,
    pedidosSinVenta,
    pagadasHoy,
    fallidasHoy,
    pendientesHoy,
    abandonadosHoy,
    ingresosHoy,
    ticketMedio,
    empresa,
    productosActivos,
  ] = await Promise.all([
    contarPedidos(inicioHoy, ahora),
    contarPedidos(haceUnaHora, ahora),
    contarPedidos(ventanaSinVenta, ahora),
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
    prisma.company.findFirst({ where: { isActive: true }, select: { settings: true, email: true, name: true } }),
    prisma.product.count({ where: { isActive: true } }).catch(() => null),
  ]);

  // Pedidos que llevan demasiado tiempo esperando un cobro que nunca llegó.
  const pendientesEstancados = await prisma.order.count({
    where: {
      paymentStatus: "PENDING",
      createdAt: { gte: restarDias(ahora, 2), lt: new Date(ahora.getTime() - 2 * 3_600_000) },
    },
  });

  // Transferencias y Zelle que siguen sin comprobante pasada una hora.
  const sinComprobante = await prisma.order.count({
    where: {
      paymentStatus: "PENDING",
      paymentProofImageUrl: null,
      createdAt: { gte: inicioHoy, lt: new Date(ahora.getTime() - 3_600_000) },
      OR: [{ orderNotes: { contains: "Banco" } }, { orderNotes: { contains: "Zelle" } }],
    },
  }).catch(() => null);

  const clientesHoy = await prisma.order.findMany({
    where: { createdAt: { gte: inicioHoy, lt: ahora } },
    select: { customerEmail: true, customerPhone: true },
  });
  const clientesUnicos = new Set(
    clientesHoy.map((pedido) => (pedido.customerEmail || pedido.customerPhone || "").trim().toLowerCase()).filter(Boolean),
  ).size;

  const historico = await pedidosEsperadosAEstaHora(ahora);

  return {
    momento: ahora.toISOString(),
    horaLocal: ahora.getHours(),
    enHorarioComercial: ahora.getHours() >= HORA_INICIO && ahora.getHours() < HORA_FIN,
    pedidosHoy,
    pedidosUltimaHora,
    pedidosEnVentana: pedidosSinVenta,
    ventanaHoras: HORAS_SIN_VENTA,
    pagadasHoy,
    fallidasHoy,
    pendientesHoy,
    pendientesEstancados,
    sinComprobante,
    abandonadosHoy,
    clientesUnicos,
    ingresosHoy: Number(ingresosHoy?._sum?.total || 0),
    ticketMedio: Number(ticketMedio?._avg?.total || 0),
    esperadoAEstaHora: historico.media,
    historicoMuestras: historico.muestras,
    aceptaPedidos: empresa?.settings?.acceptOrders !== false,
    productosActivos,
    empresa: empresa?.name || "DIFIORI",
    correoEmpresa: empresa?.email || null,
  };
}

function construirCorreo(m, avisos) {
  const filas = [
    ["Pedidos hoy", m.pedidosHoy],
    ["Pagados hoy", m.pagadasHoy],
    ["Ingresos cobrados hoy", dinero(m.ingresosHoy)],
    ["Ticket medio", dinero(m.ticketMedio)],
    ["Clientes distintos hoy", m.clientesUnicos],
    ["Pedidos última hora", m.pedidosUltimaHora],
    ["Esperado a esta hora", m.esperadoAEstaHora === null ? "sin histórico" : m.esperadoAEstaHora.toFixed(1)],
    ["Pendientes de pago", m.pendientesHoy],
    ["Pagos fallidos hoy", m.fallidasHoy],
    ["Carritos abandonados hoy", m.abandonadosHoy],
  ];

  const tabla = filas
    .map(
      ([etiqueta, valor]) =>
        `<tr><td style="padding:7px 0;color:#7c6a8d;font-weight:700;">${etiqueta}</td><td style="padding:7px 0;color:#2f2438;font-size:17px;font-weight:800;">${valor}</td></tr>`,
    )
    .join("");

  const listaAvisos = avisos
    .map(
      (aviso) =>
        `<li style="margin-bottom:12px;"><strong style="color:#b3261e;">[${aviso.nivel}] ${aviso.titulo}</strong><br/><span style="color:#5e4b70;">${aviso.detalle}</span></li>`,
    )
    .join("");

  const asunto = avisos.length
    ? `[${avisos[0].nivel}] ${avisos[0].titulo} - ${m.empresa}`
    : `Resumen de ventas del día - ${m.empresa}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:26px;border:1px solid #eee;border-radius:18px;background:#fff;">
      <h2 style="margin:0 0 4px;color:#5A3F73;font-size:26px;">${avisos.length ? "Aviso del vigilante de ventas" : "Resumen del día"}</h2>
      <p style="margin:0 0 20px;color:#7c6a8d;font-size:14px;">${new Date(m.momento).toLocaleString("es-EC")}</p>
      ${avisos.length ? `<ul style="padding-left:18px;margin:0 0 22px;">${listaAvisos}</ul>` : ""}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${tabla}</table>
      <p style="margin-top:24px;font-size:12px;color:#999;">Mensaje automático del vigilante de ventas. Se envía como máximo una vez cada ${COOLDOWN_HORAS} horas por tipo de aviso.</p>
    </div>`;

  return { asunto, html };
}

async function enviarCorreo(destinatario, asunto, html) {
  const transporter = nodemailer.createTransport(getSmtpConfig());
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || getDefaultFrom(),
    to: destinatario,
    subject: asunto,
    html,
  });
}

async function main() {
  const metricas = await recogerMetricas();

  if (SOLO_JSON) {
    console.log(JSON.stringify(metricas, null, 2));
    return;
  }

  const avisos = RESUMEN_DIARIO ? [] : evaluarAvisos(metricas, { caidaPct: CAIDA_PCT });
  const estado = leerEstado();
  const porNotificar = avisos.filter((aviso) => !enSilencio(estado, aviso.clave));

  businessLog("WATCHDOG", "CHECK", {
    pedidosHoy: metricas.pedidosHoy,
    pagadasHoy: metricas.pagadasHoy,
    ingresosHoy: metricas.ingresosHoy,
    pedidosUltimaHora: metricas.pedidosUltimaHora,
    esperadoAEstaHora: metricas.esperadoAEstaHora,
    abandonadosHoy: metricas.abandonadosHoy,
    clientesUnicos: metricas.clientesUnicos,
    avisos: avisos.map((aviso) => aviso.clave),
    avisosNuevos: porNotificar.map((aviso) => aviso.clave),
  });

  for (const aviso of avisos) {
    console.log(`[${aviso.nivel}] ${aviso.titulo} :: ${aviso.detalle}`);
  }

  if (!RESUMEN_DIARIO && porNotificar.length === 0) {
    if (avisos.length === 0) console.log("Todo en orden: no hay avisos que enviar.");
    else console.log("Hay avisos, pero ya se notificaron hace poco. No se reenvía.");
    return;
  }

  const destinatario =
    process.env.WATCHDOG_ALERT_EMAIL ||
    process.env.COMPANY_EMAIL ||
    metricas.correoEmpresa ||
    process.env.EMAIL_USER;

  if (!destinatario) {
    businessError("WATCHDOG", "NO_RECIPIENT", new Error("Sin destinatario para el aviso"), {});
    return;
  }

  const { asunto, html } = construirCorreo(metricas, porNotificar);

  if (SIN_ENVIAR) {
    console.log(`\n(--dry-run) No se envía correo. Destinatario habría sido: ${destinatario}`);
    console.log(`Asunto: ${asunto}`);
    return;
  }

  await enviarCorreo(destinatario, asunto, html);
  const ahoraIso = new Date().toISOString();
  porNotificar.forEach((aviso) => {
    estado.avisos[aviso.clave] = ahoraIso;
  });
  guardarEstado(estado);

  businessLog("WATCHDOG", "ALERT_SENT", { destinatario, avisos: porNotificar.map((a) => a.clave) });
}

main()
  .catch(async (error) => {
    businessError("WATCHDOG", "RUN_FAILED", error, {});
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
