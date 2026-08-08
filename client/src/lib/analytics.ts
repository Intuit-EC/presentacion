type GtagEventParams = Record<string, unknown>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function initGoogleAnalytics(measurementId: string | undefined) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const id = String(measurementId || "").trim();
  if (!/^G-[A-Z0-9]+$/i.test(id)) return false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer?.push(args));
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false });

  if (!document.querySelector(`script[data-ga-measurement-id="${id}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    script.dataset.gaMeasurementId = id;
    document.head.appendChild(script);
  }

  return true;
}

export function trackGaEvent(eventName: string, params?: GtagEventParams) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("event", eventName, params);
}

export function buildGaItem({
  id,
  name,
  category,
  price,
  quantity = 1,
}: {
  id: string;
  name: string;
  category?: string;
  price: number | string;
  quantity?: number;
}) {
  return {
    item_id: id,
    item_name: name,
    item_category: category,
    price: normalizeGaNumber(price),
    quantity,
  };
}

function normalizeGaNumber(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
