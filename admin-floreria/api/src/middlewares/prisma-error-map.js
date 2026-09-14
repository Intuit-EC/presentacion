/**
 * Traduce los códigos de error de Prisma a algo que el administrador pueda
 * accionar. Vive aparte del manejador para poder probarse sin base de datos ni
 * cliente de Prisma instalado.
 *
 * La regla: el mensaje debe decir qué hacer. "Error de base de datos" a secas
 * no deja forma de saber si falta migrar, si el dato está repetido o si el
 * formulario envió algo mal.
 */

const MENSAJES = {
  P2002: { status: 409, message: "Violación de restricción única" },
  P2003: { status: 409, message: "Fallo de integridad referencial (foreign key)" },
  P2025: { status: 404, message: "Registro no encontrado" },
  P2014: { status: 400, message: "Relación inválida" },
  P2000: { status: 400, message: "Valor fuera de rango" },
  P2011: { status: 400, message: "Falta un dato obligatorio." },
  P2021: {
    status: 500,
    message:
      "La base de datos no tiene una tabla que el sistema necesita. Falta aplicar las migraciones.",
  },
  P2022: {
    status: 500,
    message:
      "La base de datos no tiene una columna que el sistema necesita. Falta aplicar una " +
      "migración: reinicia el servidor del backend o ejecuta las migraciones pendientes.",
  },
};

function mapearErrorPrisma(code, meta) {
  const conocido = MENSAJES[code];

  if (conocido) {
    return { status: conocido.status, message: conocido.message, code, details: meta || undefined };
  }

  return {
    status: 500,
    message: `Error de base de datos (${code})`,
    code,
    details: meta || undefined,
  };
}

module.exports = { mapearErrorPrisma, MENSAJES };
