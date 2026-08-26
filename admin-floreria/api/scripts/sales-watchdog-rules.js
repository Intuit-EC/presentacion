/**
 * Reglas del vigilante de ventas, separadas de la base de datos y del correo
 * para poder probarlas sin levantar nada: reciben métricas y devuelven avisos.
 */

const SEMANAS_HISTORICO = 4;

function porcentaje(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

function dinero(valor) {
  return `$${Number(valor || 0).toFixed(2)}`;
}

/**
 * @param {object} m  métricas recogidas por el vigilante
 * @param {object} opciones  { caidaPct }
 * @returns {Array<{clave:string, nivel:string, titulo:string, detalle:string}>}
 */
function evaluarAvisos(m, opciones = {}) {
  const caidaPct = Number(opciones.caidaPct || 40);
  const avisos = [];

  if (!m.aceptaPedidos) {
    avisos.push({
      clave: "tienda-cerrada",
      nivel: "CRITICO",
      titulo: "La tienda está cerrada y no recibe pedidos",
      detalle:
        "En el panel, 'Aceptar pedidos' está desactivado. Nadie puede comprar aunque entre tráfico. Actívalo si no fue intencional.",
    });
  }

  if (m.productosActivos === 0) {
    avisos.push({
      clave: "catalogo-vacio",
      nivel: "CRITICO",
      titulo: "El catálogo no tiene productos activos",
      detalle: "La tienda se ve vacía para los clientes.",
    });
  }

  const esperado = m.esperadoAEstaHora;

  if (m.enHorarioComercial && m.pedidosEnVentana === 0) {
    const referencia =
      esperado === null || esperado === undefined
        ? "No hay histórico para comparar."
        : `A esta hora suele haber unos ${esperado.toFixed(1)} pedidos.`;

    avisos.push({
      clave: "sin-ventas",
      nivel: "CRITICO",
      titulo: `Sin una sola venta en ${m.ventanaHoras} horas`,
      detalle: `${referencia} Revisa que la web cargue, que el pago funcione y que la publicidad siga activa.`,
    });
  }

  if (
    esperado !== null &&
    esperado !== undefined &&
    esperado >= 2 &&
    m.pedidosEnVentana > 0 &&
    m.pedidosHoy < (esperado * caidaPct) / 100
  ) {
    avisos.push({
      clave: "caida-ventas",
      nivel: "ALTO",
      titulo: "Las ventas van muy por debajo de lo normal",
      detalle: `Hoy ${m.pedidosHoy} pedidos a esta hora, frente a ${esperado.toFixed(1)} de media los mismos días de las últimas ${SEMANAS_HISTORICO} semanas.`,
    });
  }

  const intentos = m.pagadasHoy + m.fallidasHoy;
  if (intentos >= 3 && porcentaje(m.fallidasHoy, intentos) > 30) {
    avisos.push({
      clave: "pagos-fallando",
      nivel: "CRITICO",
      titulo: "Muchos pagos están fallando",
      detalle: `${m.fallidasHoy} de ${intentos} intentos de cobro fallaron hoy (${porcentaje(m.fallidasHoy, intentos)}%). Revisa PayPal y Payphone.`,
    });
  }

  if (m.pendientesEstancados >= 3) {
    avisos.push({
      clave: "pendientes-estancados",
      nivel: "ALTO",
      titulo: `${m.pendientesEstancados} pedidos llevan más de 2 horas sin completar el pago`,
      detalle:
        "Suele indicar que el cliente se quedó a mitad de la pasarela. Vale la pena escribirles por WhatsApp.",
    });
  }

  if (m.sinComprobante !== null && m.sinComprobante !== undefined && m.sinComprobante >= 3) {
    avisos.push({
      clave: "sin-comprobante",
      nivel: "MEDIO",
      titulo: `${m.sinComprobante} transferencias sin comprobante adjunto`,
      detalle:
        "Si se repite a diario, puede que la subida del comprobante esté fallando en el checkout.",
    });
  }

  // Solo tiene sentido comparar abandonos con ventas cuando hay ventas. Si no
  // hay ninguna, el aviso que importa es "sin ventas" y este solo haría ruido.
  if (m.pedidosHoy > 0 && m.abandonadosHoy >= 5 && m.abandonadosHoy > m.pedidosHoy * 3) {
    avisos.push({
      clave: "abandono-alto",
      nivel: "MEDIO",
      titulo: "Se abandonan muchos más carritos de los que se cierran",
      detalle: `${m.abandonadosHoy} carritos abandonados frente a ${m.pedidosHoy} pedidos hoy. Recupéralos por WhatsApp.`,
    });
  }

  return avisos;
}

module.exports = { evaluarAvisos, porcentaje, dinero, SEMANAS_HISTORICO };
