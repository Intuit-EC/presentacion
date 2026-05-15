function cleanValue(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: process.env.NODE_ENV === "development" ? value.stack : undefined,
    };
  }
  return value;
}

function sanitizeDetails(details = {}) {
  return Object.fromEntries(
    Object.entries(details)
      .map(([key, value]) => [key, cleanValue(value)])
      .filter(([, value]) => value !== null)
  );
}

function businessLog(category, action, details = {}) {
  const normalizedCategory = String(category || "LOG").toUpperCase();
  const normalizedAction = String(action || "EVENT").toUpperCase();
  const payload = sanitizeDetails({
    at: new Date().toISOString(),
    ...details,
  });

  console.log(`[${normalizedCategory}][${normalizedAction}]`, JSON.stringify(payload));
}

function businessError(category, action, error, details = {}) {
  const normalizedCategory = String(category || "ERROR").toUpperCase();
  const normalizedAction = String(action || "FAILED").toUpperCase();
  const payload = sanitizeDetails({
    at: new Date().toISOString(),
    ...details,
    error: error instanceof Error ? error.message : error,
    stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
  });

  console.error(`[ERROR][${normalizedCategory}][${normalizedAction}]`, JSON.stringify(payload));
}

exports.log = (message) => {
  console.log(`[LOG]: ${message}`);
};

exports.businessLog = businessLog;
exports.businessError = businessError;
