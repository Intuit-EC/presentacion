function getBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 465);
  const secure = getBooleanEnv(
    process.env.SMTP_SECURE || process.env.EMAIL_SECURE,
    port === 465
  );
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  };
}

function getDefaultFrom() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || "noreply@difiori.com.ec";
  const companyName = process.env.COMPANY_NAME || "DIFIORI";
  return process.env.EMAIL_FROM || `"${companyName}" <${user}>`;
}

function getSalesNotificationEmail(explicitRecipient) {
  return String(
    explicitRecipient ||
      process.env.OWNER_NOTIFICATION_EMAIL ||
      process.env.SALES_NOTIFICATION_EMAIL ||
      "ventas@difiori.com.ec"
  ).trim();
}

function getSmtpPublicStatus() {
  const config = getSmtpConfig();
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    credentialsConfigured: Boolean(config.auth?.user && config.auth?.pass),
    senderConfigured: Boolean(process.env.EMAIL_FROM || config.auth?.user),
    notificationRecipient: getSalesNotificationEmail(),
  };
}

module.exports = {
  getDefaultFrom,
  getSalesNotificationEmail,
  getSmtpConfig,
  getSmtpPublicStatus,
};
