const FACEBOOK_PIXEL_ID = "1783051885578047";

type FacebookPixel = ((action: string, eventName: string, params?: Record<string, unknown>) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => number;
};

declare global {
  interface Window {
    fbq?: FacebookPixel;
    _fbq?: typeof window.fbq;
  }
}

export function initFacebookPixel() {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof window.fbq === "function") {
    return;
  }

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }

    fbq.queue.push(args);
  } as FacebookPixel;

  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = (...args: unknown[]) => fbq.queue.push(args);

  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", FACEBOOK_PIXEL_ID);
  fbq("track", "PageView");
}

export function trackFacebookEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  // El pixel arranca de forma diferida para no penalizar la carga. Si el visitante
  // llega a un evento de venta antes de ese arranque lo inicializamos aqui: el
  // stub encola los eventos y los envia en cuanto carga el script real.
  if (typeof window.fbq !== "function") {
    initFacebookPixel();
  }

  window.fbq?.("track", eventName, params);
}
