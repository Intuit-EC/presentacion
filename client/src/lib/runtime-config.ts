export interface PublicAppConfig {
  siteUrl: string;
  assetBaseUrl?: string;
  gaMeasurementId?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<PublicAppConfig>;
  }
}

const DEFAULT_SITE_URL = "https://difiori.com.ec";

function normalizeUrl(value?: string | null) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.replace(/\/$/, "") : "";
}

function readProcessEnv(name: string) {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }

  return process.env[name];
}

function readBrowserConfig() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.__APP_CONFIG__;
}

function readBrowserOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return normalizeUrl(window.location.origin);
}

export function getPublicAppConfig(): PublicAppConfig {
  const browserConfig = readBrowserConfig();

  const siteUrl =
    normalizeUrl(
      browserConfig?.siteUrl ||
        readProcessEnv("APP_PUBLIC_SITE_URL") ||
        readProcessEnv("SITE_URL") ||
        readProcessEnv("VITE_SITE_URL"),
    ) || DEFAULT_SITE_URL;

  const assetBaseUrl =
    normalizeUrl(
      browserConfig?.assetBaseUrl ||
        readProcessEnv("APP_PUBLIC_ASSET_URL") ||
        readProcessEnv("ASSET_BASE_URL") ||
        readProcessEnv("VITE_ASSET_BASE_URL"),
    ) || readBrowserOrigin();

  const gaMeasurementId = String(
    browserConfig?.gaMeasurementId ||
      readProcessEnv("GA_MEASUREMENT_ID") ||
      readProcessEnv("VITE_GA_MEASUREMENT_ID") ||
      "",
  ).trim();

  return {
    siteUrl,
    assetBaseUrl: assetBaseUrl || undefined,
    ...(gaMeasurementId ? { gaMeasurementId } : {}),
  };
}
