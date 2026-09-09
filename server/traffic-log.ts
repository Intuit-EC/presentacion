import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

/**
 * Medición propia del recorrido de los visitantes.
 *
 * Existe porque la tienda no tiene Analytics configurado y, sin saber cuánta
 * gente entra y dónde se cae, cualquier decisión sobre catálogo o publicidad es
 * adivinar. Cuenta visitas por tipo de página y nada más: no guarda IPs, ni
 * identificadores, ni usa cookies. Solo contadores agregados por día y hora.
 */

export type TipoPagina =
  | "inicio"
  | "catalogo"
  | "producto"
  | "landing"
  | "contacto"
  | "checkout"
  | "resultado_pago"
  | "otra";

type ContadoresDia = {
  fecha: string;
  personas: Record<TipoPagina, number>;
  bots: Record<TipoPagina, number>;
  porHora: Record<string, number>;
  productosVistos: Record<string, number>;
};

type Registro = { dias: Record<string, ContadoresDia> };

const RUTA_ARCHIVO = resolve(
  process.env.TRAFFIC_LOG_PATH || resolve(process.cwd(), "logs", "traffic.json"),
);
const DIAS_A_CONSERVAR = 30;
const GUARDADO_CADA_MS = 20_000;
const TOP_PRODUCTOS = 40;

// Los rastreadores no compran: separarlos evita creer que hay tráfico real.
const PATRON_BOT =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|headless|lighthouse|pagespeed|monitor|watchdog|uptime|semrush|ahrefs|mj12|dotbot|petal|yandex|baidu/i;

let registro: Registro = { dias: {} };
let cargado = false;
let sucio = false;
let guardadoProgramado: NodeJS.Timeout | null = null;

function contadoresVacios(fecha: string): ContadoresDia {
  const cero = (): Record<TipoPagina, number> => ({
    inicio: 0,
    catalogo: 0,
    producto: 0,
    landing: 0,
    contacto: 0,
    checkout: 0,
    resultado_pago: 0,
    otra: 0,
  });

  return { fecha, personas: cero(), bots: cero(), porHora: {}, productosVistos: {} };
}

function cargar() {
  if (cargado) return;
  cargado = true;

  try {
    if (existsSync(RUTA_ARCHIVO)) {
      const datos = JSON.parse(readFileSync(RUTA_ARCHIVO, "utf8"));
      if (datos && typeof datos === "object" && datos.dias) registro = datos as Registro;
    }
  } catch {
    // Un archivo corrupto no debe tumbar la tienda: se empieza de cero.
    registro = { dias: {} };
  }
}

function guardar() {
  try {
    mkdirSync(dirname(RUTA_ARCHIVO), { recursive: true });
    writeFileSync(RUTA_ARCHIVO, JSON.stringify(registro));
    sucio = false;
  } catch {
    // Si no se puede escribir, se sigue contando en memoria.
  }
}

function programarGuardado() {
  sucio = true;
  if (guardadoProgramado) return;

  guardadoProgramado = setTimeout(() => {
    guardadoProgramado = null;
    if (sucio) guardar();
  }, GUARDADO_CADA_MS);

  guardadoProgramado.unref?.();
}

/** Fecha local de Guayaquil, para que "hoy" signifique lo mismo que en el negocio. */
function ahoraLocal() {
  const desfase = Number(process.env.WATCHDOG_UTC_OFFSET_MINUTES || -300);
  return new Date(Date.now() + desfase * 60_000);
}

function limpiarAntiguos() {
  const claves = Object.keys(registro.dias).sort();
  while (claves.length > DIAS_A_CONSERVAR) {
    const vieja = claves.shift();
    if (vieja) delete registro.dias[vieja];
  }
}

/** Evita que el archivo crezca sin control si aparecen URLs raras de producto. */
function podarProductos(dia: ContadoresDia) {
  const claves = Object.keys(dia.productosVistos);
  if (claves.length <= TOP_PRODUCTOS) return;

  const conservar = new Set(
    claves.sort((a, b) => dia.productosVistos[b] - dia.productosVistos[a]).slice(0, TOP_PRODUCTOS),
  );
  for (const clave of claves) {
    if (!conservar.has(clave)) delete dia.productosVistos[clave];
  }
}

export function clasificarRuta(path: string): TipoPagina | null {
  if (path === "/") return "inicio";
  if (path === "/shop" || path.startsWith("/categoria/")) return "catalogo";
  if (path.startsWith("/producto/") || path.startsWith("/product/")) return "producto";
  if (path === "/contacto") return "contacto";
  if (path === "/checkout") return "checkout";
  if (path === "/payment-result" || path === "/payment-gateway") return "resultado_pago";

  // Rutas técnicas y archivos: no son visitas de personas.
  if (
    path.startsWith("/api") ||
    path.startsWith("/assets") ||
    path.startsWith("/uploads") ||
    path.startsWith("/image-proxy") ||
    path.includes(".")
  ) {
    return null;
  }

  return "otra";
}

export function registrarVisita(path: string, userAgent: string, esLanding: boolean) {
  cargar();

  const tipoBase = clasificarRuta(path);
  if (!tipoBase) return;

  const tipo: TipoPagina = esLanding && tipoBase === "otra" ? "landing" : tipoBase;
  const ahora = ahoraLocal();
  const fecha = ahora.toISOString().slice(0, 10);

  if (!registro.dias[fecha]) {
    registro.dias[fecha] = contadoresVacios(fecha);
    limpiarAntiguos();
  }

  const dia = registro.dias[fecha];
  const esBot = PATRON_BOT.test(userAgent || "") || !userAgent;

  if (esBot) {
    dia.bots[tipo] += 1;
  } else {
    dia.personas[tipo] += 1;
    const hora = String(ahora.getHours()).padStart(2, "0");
    dia.porHora[hora] = (dia.porHora[hora] || 0) + 1;

    if (tipo === "producto") {
      const slug = path.replace(/^\/(producto|product)\//, "").slice(0, 90);
      if (slug) {
        dia.productosVistos[slug] = (dia.productosVistos[slug] || 0) + 1;
        podarProductos(dia);
      }
    }
  }

  programarGuardado();
}

function sumar(dias: ContadoresDia[], campo: "personas" | "bots") {
  const total: Record<string, number> = {};
  for (const dia of dias) {
    for (const [tipo, valor] of Object.entries(dia[campo])) {
      total[tipo] = (total[tipo] || 0) + valor;
    }
  }
  return total;
}

export function obtenerResumen(dias = 7) {
  cargar();

  const fechas = Object.keys(registro.dias).sort().slice(-dias);
  const seleccion = fechas.map((fecha) => registro.dias[fecha]);
  const personas = sumar(seleccion, "personas");
  const bots = sumar(seleccion, "bots");

  const visitas = Object.values(personas).reduce((suma, valor) => suma + valor, 0);
  const vieronProducto = personas.producto || 0;
  const llegaronAlPago = personas.checkout || 0;

  const porHora: Record<string, number> = {};
  for (const dia of seleccion) {
    for (const [hora, valor] of Object.entries(dia.porHora)) {
      porHora[hora] = (porHora[hora] || 0) + valor;
    }
  }

  const productos: Record<string, number> = {};
  for (const dia of seleccion) {
    for (const [slug, valor] of Object.entries(dia.productosVistos)) {
      productos[slug] = (productos[slug] || 0) + valor;
    }
  }

  const masVistos = Object.entries(productos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([slug, vistas]) => ({ slug, vistas }));

  return {
    desde: fechas[0] || null,
    hasta: fechas[fechas.length - 1] || null,
    diasConDatos: fechas.length,
    visitasDePersonas: visitas,
    visitasDeBots: Object.values(bots).reduce((suma, valor) => suma + valor, 0),
    porTipoDePagina: personas,
    // El embudo: de cada 100 que entran, cuántos miran un producto y cuántos
    // llegan a la página de pago. Ahí se ve dónde se cae la gente.
    embudo: {
      visitas,
      vieronProducto,
      llegaronAlPago,
      porcentajeQueVeProducto: visitas ? Math.round((vieronProducto / visitas) * 100) : 0,
      porcentajeQueLlegaAlPago: visitas ? Math.round((llegaronAlPago / visitas) * 100) : 0,
    },
    porHora,
    productosMasVistos: masVistos,
    porDia: seleccion.map((dia) => ({
      fecha: dia.fecha,
      personas: Object.values(dia.personas).reduce((suma, valor) => suma + valor, 0),
    })),
  };
}

/** Se expone solo para las pruebas, que necesitan partir de un estado limpio. */
export function _reiniciarParaPruebas() {
  registro = { dias: {} };
  cargado = true;
  sucio = false;
}

export function _forzarGuardado() {
  if (sucio) guardar();
}
