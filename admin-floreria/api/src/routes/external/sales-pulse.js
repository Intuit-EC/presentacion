const express = require("express");
const crypto = require("crypto");

const { obtenerPulsoDeVentas } = require("../../services/salesPulseService");
const { businessError } = require("../../utils/logger");

const router = express.Router();

/**
 * Compara sin filtrar información por el tiempo de respuesta.
 */
function tokenValido(recibido, esperado) {
  const a = Buffer.from(String(recibido || ""));
  const b = Buffer.from(String(esperado || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/external/sales-pulse
 *
 * Deja vigilar el ritmo de ventas desde fuera del servidor sin dar acceso a la
 * base de datos. Son cifras del negocio, así que exige un token propio: si no
 * está configurado, el endpoint no existe.
 */
router.get("/", async (req, res) => {
  const esperado = process.env.WATCHDOG_TOKEN;

  if (!esperado) {
    return res.status(404).json({ status: "error", message: "No disponible." });
  }

  const recibido = req.headers["x-watchdog-token"];
  if (!tokenValido(recibido, esperado)) {
    return res.status(401).json({ status: "error", message: "Token inválido." });
  }

  try {
    const pulso = await obtenerPulsoDeVentas({
      horasVentana: Number(req.query.horas || process.env.WATCHDOG_HORAS_SIN_VENTA || 5),
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ status: "success", data: pulso });
  } catch (error) {
    businessError("WATCHDOG", "SALES_PULSE_FAILED", error, {});
    return res.status(500).json({ status: "error", message: "No se pudo leer el pulso de ventas." });
  }
});

module.exports = router;
