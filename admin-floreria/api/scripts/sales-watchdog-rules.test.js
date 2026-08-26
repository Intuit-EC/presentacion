/**
 * Prueba de las reglas del vigilante: se ejecuta con `node` a secas, sin base de
 * datos ni dependencias. Sirve para confirmar que avisa cuando debe y, sobre
 * todo, que se calla cuando el negocio va normal (un vigilante que avisa de todo
 * se acaba ignorando).
 */

const assert = require("node:assert");
const { evaluarAvisos } = require("./sales-watchdog-rules");

const diaNormal = {
  aceptaPedidos: true,
  productosActivos: 137,
  enHorarioComercial: true,
  ventanaHoras: 5,
  pedidosEnVentana: 4,
  pedidosHoy: 9,
  pagadasHoy: 7,
  fallidasHoy: 1,
  pendientesHoy: 1,
  pendientesEstancados: 0,
  sinComprobante: 0,
  abandonadosHoy: 6,
  esperadoAEstaHora: 8.5,
};

const casos = [
  {
    nombre: "Día normal: no avisa de nada",
    metricas: diaNormal,
    esperado: [],
  },
  {
    nombre: "Tienda cerrada por error en el panel",
    metricas: { ...diaNormal, aceptaPedidos: false },
    esperado: ["tienda-cerrada"],
  },
  {
    nombre: "Cinco horas sin una sola venta en horario comercial",
    metricas: { ...diaNormal, pedidosEnVentana: 0, pedidosHoy: 0 },
    esperado: ["sin-ventas"],
  },
  {
    nombre: "Madrugada sin ventas: NO debe avisar",
    metricas: { ...diaNormal, enHorarioComercial: false, pedidosEnVentana: 0, pedidosHoy: 0 },
    esperado: [],
  },
  {
    nombre: "Vende, pero muy por debajo de lo habitual",
    metricas: { ...diaNormal, pedidosHoy: 2, pedidosEnVentana: 1, esperadoAEstaHora: 10 },
    esperado: ["caida-ventas"],
  },
  {
    nombre: "Día flojo pero dentro de lo normal: NO debe avisar",
    metricas: { ...diaNormal, pedidosHoy: 5, esperadoAEstaHora: 8 },
    esperado: [],
  },
  {
    nombre: "La pasarela está rechazando pagos",
    metricas: { ...diaNormal, pagadasHoy: 2, fallidasHoy: 5 },
    esperado: ["pagos-fallando"],
  },
  {
    nombre: "Un fallo suelto de tarjeta: NO debe avisar",
    metricas: { ...diaNormal, pagadasHoy: 9, fallidasHoy: 1 },
    esperado: [],
  },
  {
    nombre: "Pedidos atascados sin completar el pago",
    metricas: { ...diaNormal, pendientesEstancados: 4 },
    esperado: ["pendientes-estancados"],
  },
  {
    nombre: "Transferencias sin comprobante (subida rota)",
    metricas: { ...diaNormal, sinComprobante: 5 },
    esperado: ["sin-comprobante"],
  },
  {
    nombre: "Se abandona mucho más de lo que se cierra",
    metricas: { ...diaNormal, pedidosHoy: 1, abandonadosHoy: 12, pedidosEnVentana: 1, esperadoAEstaHora: 1 },
    esperado: ["abandono-alto"],
  },
  {
    nombre: "Catálogo vacío",
    metricas: { ...diaNormal, productosActivos: 0 },
    esperado: ["catalogo-vacio"],
  },
  {
    nombre: "Sin histórico todavía: avisa igual si no hay ventas",
    metricas: { ...diaNormal, esperadoAEstaHora: null, pedidosEnVentana: 0, pedidosHoy: 0 },
    esperado: ["sin-ventas"],
  },
];

let fallos = 0;

for (const caso of casos) {
  const claves = evaluarAvisos(caso.metricas).map((aviso) => aviso.clave).sort();
  const esperado = [...caso.esperado].sort();

  try {
    assert.deepStrictEqual(claves, esperado);
    console.log(`✓ ${caso.nombre}`);
  } catch {
    fallos += 1;
    console.error(`✗ ${caso.nombre}`);
    console.error(`   esperado: [${esperado.join(", ")}]`);
    console.error(`   obtenido: [${claves.join(", ")}]`);
  }
}

if (fallos > 0) {
  console.error(`\n${fallos} caso(s) fallaron.`);
  process.exitCode = 1;
} else {
  console.log(`\nTodas las reglas se comportan como se espera (${casos.length} casos).`);
}
