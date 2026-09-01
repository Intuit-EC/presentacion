/**
 * Vigilante de la tienda DIFIORI.
 *
 * Comprueba, desde fuera y como lo haría un cliente, que la tienda se pueda
 * comprar ahora mismo: que cargue, que el catálogo tenga productos, que acepte
 * pedidos, que las pasarelas respondan y que los enlaces de publicidad lleven a
 * la tienda y no a una página de error.
 *
 * Uso:
 *   npx tsx script/storefront-watchdog.ts
 *   npx tsx script/storefront-watchdog.ts --json
 *
 * Sale con código 1 si algo crítico falla, para que cron o el CI lo detecten.
 */

type Severidad = "CRITICO" | "ALTO" | "AVISO";

type Resultado = {
  nombre: string;
  ok: boolean;
  severidad: Severidad;
  detalle: string;
  ms: number;
};

const BASE_URL = normalizarBase(process.env.WATCHDOG_BASE_URL || "https://difiori.com.ec");
const TIMEOUT_MS = Number(process.env.WATCHDOG_TIMEOUT_MS || 15000);
const LENTO_MS = Number(process.env.WATCHDOG_LENTO_MS || 4000);
const SOLO_JSON = process.argv.includes("--json");
const USER_AGENT = "DIFIORI-Watchdog/1.0 (+monitoreo; no-analytics-bot)";
const WATCHDOG_TOKEN = process.env.WATCHDOG_TOKEN || "";

// Parámetros que añaden Facebook, Instagram y Google a cada clic de anuncio.
const PARAMETROS_PUBLICIDAD = [
  "?fbclid=IwAR_watchdog",
  "?utm_source=facebook&utm_medium=cpc&utm_campaign=watchdog",
  "?gclid=watchdog123",
];

function normalizarBase(valor: string) {
  const limpio = valor.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(limpio)) throw new Error(`URL base inválida: ${valor}`);
  return limpio;
}

async function pedir(ruta: string, cabecerasExtra: Record<string, string> = {}) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${BASE_URL}${ruta}`, {
      redirect: "follow",
      signal: controlador.signal,
      headers: { "User-Agent": USER_AGENT, "Cache-Control": "no-cache", ...cabecerasExtra },
    });
    const cuerpo = await respuesta.text();
    return { status: respuesta.status, cuerpo };
  } finally {
    clearTimeout(temporizador);
  }
}

async function postear(ruta: string, cuerpo: unknown) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${BASE_URL}${ruta}`, {
      method: "POST",
      signal: controlador.signal,
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify(cuerpo),
    });
    return { status: respuesta.status, cuerpo: await respuesta.text() };
  } finally {
    clearTimeout(temporizador);
  }
}

async function medir(
  nombre: string,
  severidad: Severidad,
  ejecutar: () => Promise<{ ok: boolean; detalle: string }>,
): Promise<Resultado> {
  const inicio = Date.now();
  try {
    const { ok, detalle } = await ejecutar();
    return { nombre, ok, severidad, detalle, ms: Date.now() - inicio };
  } catch (error) {
    return {
      nombre,
      ok: false,
      severidad,
      detalle: error instanceof Error ? error.message : String(error),
      ms: Date.now() - inicio,
    };
  }
}

type EstadoPasarela = {
  nombre: string;
  entorno: string;
  lista: boolean;
};

/**
 * Cuando una ruta de API no está publicada, el servidor devuelve el HTML de la
 * tienda. Sin esto, el vigilante moría con un error de JSON y no se entendía
 * qué estaba pasando; un monitor que se rompe es peor que no tenerlo.
 */
function leerJson(cuerpo: string, contexto: string) {
  try {
    return JSON.parse(cuerpo);
  } catch {
    const recorte = cuerpo.trim().slice(0, 40).replace(/\s+/g, " ");
    throw new Error(`${contexto} no devolvió JSON (recibido: "${recorte}...")`);
  }
}

async function obtenerEstadoPasarela(nombre: string, ruta: string): Promise<EstadoPasarela> {
  const { status, cuerpo } = await pedir(ruta);
  if (status !== 200) return { nombre, entorno: `HTTP ${status}`, lista: false };

  const datos = leerJson(cuerpo, ruta);
  const entorno = String(datos?.data?.environment || "desconocido");
  return {
    nombre,
    entorno,
    lista: entorno === "live" && datos?.data?.readyForProduction === true,
  };
}

const comprobaciones: Array<() => Promise<Resultado>> = [
  () =>
    medir("La tienda carga", "CRITICO", async () => {
      const { status, cuerpo } = await pedir("/");
      if (status !== 200) return { ok: false, detalle: `respondió ${status}` };
      if (!cuerpo.includes("DIFIORI")) return { ok: false, detalle: "la página no trae contenido de la tienda" };
      return { ok: true, detalle: `${Math.round(cuerpo.length / 1024)} KB` };
    }),

  () =>
    medir("Los enlaces de publicidad llevan a la tienda", "CRITICO", async () => {
      const rotos: string[] = [];

      for (const parametros of PARAMETROS_PUBLICIDAD) {
        const { cuerpo } = await pedir(`/${parametros}`);
        if (/no encontrada/i.test(cuerpo)) rotos.push(parametros.slice(0, 22));
      }

      if (rotos.length > 0) {
        return {
          ok: false,
          detalle: `quien llega desde un anuncio ve "Página no encontrada" (${rotos.join(", ")})`,
        };
      }

      return { ok: true, detalle: `${PARAMETROS_PUBLICIDAD.length} formatos de enlace verificados` };
    }),

  () =>
    medir("El catálogo tiene productos", "CRITICO", async () => {
      const { status, cuerpo } = await pedir("/api/external/products");
      if (status !== 200) return { ok: false, detalle: `la API respondió ${status}` };

      const datos = leerJson(cuerpo, "/api/external/products");
      const productos: any[] = datos?.data || [];
      if (productos.length === 0) return { ok: false, detalle: "el catálogo está vacío" };

      const sinPrecio = productos.filter((p) => !p.price || p.price === "$0.00").length;
      const sinImagen = productos.filter((p) => !p.image).length;
      if (sinPrecio > 0 || sinImagen > 0) {
        return { ok: false, detalle: `${sinPrecio} sin precio y ${sinImagen} sin imagen` };
      }

      return { ok: true, detalle: `${productos.length} productos publicados` };
    }),

  () =>
    medir("La tienda acepta pedidos", "CRITICO", async () => {
      const { cuerpo } = await pedir("/api/external/company");
      const datos = leerJson(cuerpo, "/api/external/company");
      const acepta = datos?.data?.settings?.acceptOrders !== false;
      if (!acepta) return { ok: false, detalle: "'Aceptar pedidos' está desactivado en el panel" };

      const sectores = datos?.data?.settings?.paymentSettings?.shippingSectorRates?.length || 0;
      if (sectores === 0) return { ok: false, detalle: "no hay sectores de envío configurados" };

      return { ok: true, detalle: `${sectores} sectores de envío configurados` };
    }),

  () =>
    medir("El checkout está disponible", "CRITICO", async () => {
      const { status, cuerpo } = await pedir("/checkout");
      if (status !== 200) return { ok: false, detalle: `respondió ${status}` };
      if (!cuerpo.includes("Checkout")) return { ok: false, detalle: "no cargó la página de pago" };
      return { ok: true, detalle: "operativo" };
    }),

  () =>
    medir("Se pueden registrar pedidos", "CRITICO", async () => {
      // Con el cuerpo vacío debe rechazar por validación (400). Un 500 o un 502
      // significan que el backend está caído y que ningún pedido entraría.
      const { status } = await postear("/api/external/store-orders", {});
      if (status === 400) return { ok: true, detalle: "el registro de pedidos responde" };
      return { ok: false, detalle: `el backend respondió ${status} al registrar un pedido` };
    }),

  () =>
    medir("Hay pago en línea disponible", "CRITICO", async () => {
      // Una pasarela opcional en sandbox no impide vender si otra está realmente
      // operativa. El checkout ya bloquea proveedores que no estén en producción.
      const pasarelas = await Promise.all([
        obtenerEstadoPasarela("Payphone", "/api/external/payphone/health"),
        obtenerEstadoPasarela("PayPal", "/api/external/paypal/health"),
      ]);
      const listas = pasarelas.filter((pasarela) => pasarela.lista);
      const noListas = pasarelas.filter((pasarela) => !pasarela.lista);

      if (listas.length === 0) {
        return {
          ok: false,
          detalle: `ninguna pasarela cobra en producción (${pasarelas
            .map((pasarela) => `${pasarela.nombre}: ${pasarela.entorno}`)
            .join(", ")})`,
        };
      }

      const disponibles = listas.map((pasarela) => pasarela.nombre).join(", ");
      const deshabilitadas = noListas.length > 0
        ? `; no disponible: ${noListas
            .map((pasarela) => `${pasarela.nombre} (${pasarela.entorno})`)
            .join(", ")}`
        : "";

      return { ok: true, detalle: `${disponibles} en producción${deshabilitadas}` };
    }),

  () =>
    medir("Medición de visitas activa", "ALTO", async () => {
      const { cuerpo } = await pedir("/");
      if (!/"gaMeasurementId":"G-/.test(cuerpo)) {
        return { ok: false, detalle: "falta GA_MEASUREMENT_ID: no se registra ninguna visita ni venta" };
      }
      return { ok: true, detalle: "Analytics configurado" };
    }),

  () =>
    medir("Correo de ventas operativo", "CRITICO", async () => {
      const { status, cuerpo } = await pedir("/api/health/email");
      const datos = leerJson(cuerpo, "/api/health/email");
      const destinatario = datos?.smtp?.notificationRecipient || "sin destinatario";
      if (status !== 200 || datos?.ready !== true) {
        const motivo = datos?.reason ? ` ${datos.reason}` : "";
        const codigo = datos?.errorCode ? ` [${datos.errorCode}]` : "";
        return {
          ok: false,
          detalle: `no llegarán avisos de pedido a ${destinatario}${codigo}.${motivo}`,
        };
      }
      return { ok: true, detalle: `SMTP autenticado; destino ${destinatario}` };
    }),

  () =>
    medir("La tienda responde rápido", "AVISO", async () => {
      const inicio = Date.now();
      await pedir("/");
      const ms = Date.now() - inicio;
      return ms > LENTO_MS
        ? { ok: false, detalle: `tardó ${ms} ms en cargar (límite ${LENTO_MS} ms)` }
        : { ok: true, detalle: `${ms} ms` };
    }),

  // Lo anterior comprueba que la tienda SE PUEDA comprar. Esto comprueba que
  // además SE ESTÉ comprando, que es lo único que confirma que el embudo entero
  // funciona de punta a punta.
  () =>
    medir("Están entrando ventas", "CRITICO", async () => {
      if (!WATCHDOG_TOKEN) {
        return {
          ok: true,
          detalle: "sin WATCHDOG_TOKEN configurado: no se puede vigilar el ritmo de ventas",
        };
      }

      const { status, cuerpo } = await pedir("/api/external/sales-pulse", {
        "x-watchdog-token": WATCHDOG_TOKEN,
      });

      if (status === 401) return { ok: false, detalle: "el WATCHDOG_TOKEN no coincide con el del servidor" };
      if (status === 404) return { ok: false, detalle: "el servidor no tiene configurado WATCHDOG_TOKEN" };
      if (status !== 200) return { ok: false, detalle: `el pulso de ventas respondió ${status}` };

      const pulso = leerJson(cuerpo, "/api/external/sales-pulse")?.data || {};
      const esperado = pulso.esperadoAEstaHora;
      const referencia =
        typeof esperado === "number" ? ` (lo normal a esta hora son ${esperado.toFixed(1)})` : "";

      if (pulso.enHorarioComercial && pulso.pedidosEnVentana === 0) {
        const desde =
          pulso.horasDesdeUltimaVenta === null
            ? "nunca ha entrado un pedido"
            : `el último pedido entró hace ${pulso.horasDesdeUltimaVenta} h`;
        return {
          ok: false,
          detalle: `ni una venta en ${pulso.ventanaHoras} h${referencia}; ${desde}`,
        };
      }

      return {
        ok: true,
        detalle: `${pulso.pedidosHoy} pedidos hoy, ${pulso.pagadasHoy} pagados, $${Number(pulso.ingresosHoy || 0).toFixed(2)} cobrados${referencia}`,
      };
    }),
];

async function main() {
  const resultados: Resultado[] = [];

  for (const comprobacion of comprobaciones) {
    resultados.push(await comprobacion());
  }

  const fallos = resultados.filter((r) => !r.ok);
  const criticos = fallos.filter((r) => r.severidad === "CRITICO");

  if (SOLO_JSON) {
    console.log(
      JSON.stringify(
        { momento: new Date().toISOString(), base: BASE_URL, resultados, fallos: fallos.length, criticos: criticos.length },
        null,
        2,
      ),
    );
  } else {
    console.log(`Vigilante de tienda DIFIORI — ${BASE_URL}`);
    console.log(new Date().toLocaleString("es-EC"));
    console.log("");

    for (const resultado of resultados) {
      const marca = resultado.ok ? "✓" : resultado.severidad === "AVISO" ? "!" : "✗";
      console.log(`${marca} ${resultado.nombre}: ${resultado.detalle} (${resultado.ms} ms)`);
    }

    console.log("");
    if (criticos.length > 0) {
      console.log(`SE PUEDE ESTAR PERDIENDO VENTAS: ${criticos.length} problema(s) crítico(s).`);
    } else if (fallos.length > 0) {
      console.log(`La tienda vende, pero hay ${fallos.length} punto(s) que revisar.`);
    } else {
      console.log("Todo en orden: la tienda se puede comprar con normalidad.");
    }
  }

  if (criticos.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("El vigilante no pudo completar la revisión.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
