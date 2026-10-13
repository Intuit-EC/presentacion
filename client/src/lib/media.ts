import { getPublicAppConfig } from "@/lib/runtime-config";

export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%239ca3af'%3ESin imagen disponible%3C/text%3E%3C/svg%3E";

function normalizeUrl(value?: string | null) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.replace(/\/$/, "") : "";
}

function getKnownOrigins() {
  const { siteUrl, assetBaseUrl } = getPublicAppConfig();
  return [siteUrl, assetBaseUrl]
    .map((value) => normalizeUrl(value))
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

export function toPublicImageUrl(source?: string | null) {
  const value = String(source || "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("/image-proxy?")) return value;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    // Cloudinary already provides an optimized global CDN. Sending these images
    // through our server adds an avoidable network hop and hurts first paint.
    if (isCloudinaryUrl(value)) return value;

    try {
      const target = new URL(value);
      if (getKnownOrigins().includes(target.origin)) {
        return value;
      }
    } catch {
      return value;
    }

    return `/image-proxy?url=${encodeURIComponent(value)}`;
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  const { assetBaseUrl } = getPublicAppConfig();
  return assetBaseUrl ? `${assetBaseUrl}${normalizedPath}` : normalizedPath;
}

function unwrapImageProxyUrl(source: string) {
  if (!source.startsWith("/image-proxy?")) return source;

  try {
    const parsed = new URL(source, "https://difiori.com");
    return parsed.searchParams.get("url") || source;
  } catch {
    return source;
  }
}

function isCloudinaryUrl(source: string) {
  try {
    const parsed = new URL(source);
    return parsed.hostname === "res.cloudinary.com" && parsed.pathname.includes("/image/upload/");
  } catch {
    return false;
  }
}

function buildCloudinaryVariant(source: string, width: number) {
  return source.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

export function getResponsiveImageSrcSet(
  source?: string | null,
  widths: number[] = [320, 480, 640, 960],
) {
  const value = String(source || "").trim();
  if (!value || value.startsWith("data:image/")) return undefined;

  const originalSource = unwrapImageProxyUrl(value);
  if (!isCloudinaryUrl(originalSource)) return undefined;

  return widths
    .map((width) => `${buildCloudinaryVariant(originalSource, width)} ${width}w`)
    .join(", ");
}
