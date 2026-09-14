const { Prisma } = require("@prisma/client");
const { ZodError } = require("zod");
const { mapearErrorPrisma } = require("./prisma-error-map");

// Centralized error handler for Express
module.exports = function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) return next(err);

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { status, ...cuerpo } = mapearErrorPrisma(err.code, err.meta);
    return res.status(status).json({ status: "error", ...cuerpo });
  }

  // Prisma validation/runtime errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      status: "error",
      message: "Validación de datos de Prisma falló",
      details: err.message,
    });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(500).json({
      status: "error",
      message: "Falló la inicialización de la base de datos",
      details: err.message,
    });
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: "error",
      message: "Datos inválidos",
      details: err.issues,
    });
  }

  // Generic fallback
  const status = err.status || 500;
  return res.status(status).json({
    status: "error",
    message: err.message || "Error interno del servidor",
  });
}
