/**
 * Reglas del reordenamiento del catálogo, separadas de la base de datos para
 * poder probarlas sin levantar nada. El endpoint queda como una capa delgada
 * encima de esto.
 */

const MAX_PRODUCTOS_POR_PETICION = 500;

/**
 * Comprueba que la lista recibida sea utilizable y la deja limpia.
 *
 * @returns {{ok: true, ids: string[]} | {ok: false, estado: number, mensaje: string}}
 */
function validarListaDeOrden(productIds, max = MAX_PRODUCTOS_POR_PETICION) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { ok: false, estado: 400, mensaje: "Envía 'productIds' con el orden de los productos." };
  }

  if (productIds.length > max) {
    return {
      ok: false,
      estado: 400,
      mensaje: `Demasiados productos en una sola petición (máximo ${max}).`,
    };
  }

  const ids = productIds.map((id) => String(id == null ? "" : id).trim()).filter(Boolean);

  if (ids.length === 0) {
    return { ok: false, estado: 400, mensaje: "La lista no trae ningún identificador válido." };
  }

  if (new Set(ids).size !== ids.length) {
    return { ok: false, estado: 400, mensaje: "La lista trae productos repetidos." };
  }

  return { ok: true, ids };
}

/**
 * Convierte la lista ordenada en posiciones, descartando lo que no existe.
 *
 * Las posiciones empiezan en 1 para que "sin posición" (nulo) y "primera
 * posición" no se confundan al leer la base de datos.
 */
function calcularPosiciones(ids, idsExistentes) {
  const existentes = idsExistentes instanceof Set ? idsExistentes : new Set(idsExistentes);

  return ids
    .filter((id) => existentes.has(id))
    .map((id, indice) => ({ id, sortOrder: indice + 1 }));
}

module.exports = { validarListaDeOrden, calcularPosiciones, MAX_PRODUCTOS_POR_PETICION };
