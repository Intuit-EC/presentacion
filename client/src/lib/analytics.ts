type GtagEventParams = Record<string, unknown>;

declare global {
  interface Window {
    gtag?: (command: "event", eventName: string, params?: GtagEventParams) => void;
    dataLayer?: unknown[];
  }
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
