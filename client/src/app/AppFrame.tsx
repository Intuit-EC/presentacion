import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type ComponentType, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { useCompany } from "@/hooks/useCompany";
import { DEFAULT_COMPANY } from "@/lib/site";

const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })),
);

const FACEBOOK_PIXEL_ID = "1783051885578047";

type FacebookPixel = ((action: string, eventName: string) => void) & {
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

function initFacebookPixel() {
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

function isMeaningfulInteraction(event: Event) {
  if (event.type === "scroll") {
    return typeof window !== "undefined" && window.scrollY > 24;
  }

  return true;
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function FloatingWhatsApp() {
  return (
    <a
      href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-5 right-4 z-[120] inline-flex min-h-14 max-w-[calc(100vw-2rem)] items-center justify-center gap-2 rounded-full border border-white/35 bg-[#25d366] px-4 py-3 text-white shadow-[0_18px_38px_rgba(37,211,102,0.38)] ring-4 ring-[#25d366]/15 transition hover:bg-[#1ebe5d] hover:shadow-[0_22px_44px_rgba(37,211,102,0.42)] sm:bottom-8 sm:right-8 sm:min-h-[64px] sm:gap-3 sm:px-5"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 shrink-0 drop-shadow-lg sm:h-9 sm:w-9"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          fill="white"
          d="M12.031 0C5.39 0 0 5.385 0 12.028a11.96 11.96 0 001.597 6.036L0 24l6.117-1.605a11.968 11.968 0 005.918 1.564c6.64 0 12.03-5.388 12.03-12.031C24.065 5.385 18.671 0 12.031 0z"
        />
        <path
          fill="#25D366"
          d="M17.362 14.156c-.292-.146-1.728-.853-1.996-.95-.264-.097-.456-.145-.648.145-.192.29-.74.922-.907 1.114-.167.19-.334.213-.626.067-.282-.143-1.222-.45-2.328-1.435-.86-.767-1.437-1.716-1.606-2.008-.168-.291-.018-.45.126-.595.13-.133.292-.34.437-.51.144-.17.191-.291.286-.485.096-.194.048-.363-.024-.51-.07-.145-.648-1.562-.888-2.14-.23-.559-.47-.48-.648-.49-.168-.008-.36-.01-.55-.01s-.51.074-.77.345c-.26.29-1 .976-1 2.428s1.026 2.85 1.17 3.045c.145.195 2.02 3.084 4.89 4.33.682.296 1.215.474 1.63.606.69.219 1.317.187 1.815.113.553-.081 1.73-.705 1.972-1.385.242-.68.242-1.262.17-1.385-.078-.124-.282-.195-.572-.34z"
        />
      </svg>
      <span className="flex flex-col text-left leading-none">
        <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/80 sm:text-xs">
          Pedir por
        </span>
        <span className="mt-1 text-sm font-black text-white sm:text-base">
          WhatsApp
        </span>
      </span>
    </a>
  );
}

interface AppFrameProps {
  Routes: ComponentType;
  fallback?: ReactNode;
}

export function AppFrame({ Routes, fallback = <RouteFallback /> }: AppFrameProps) {
  const [location] = useLocation();
  const { data: company } = useCompany();
  const hasTrackedInitialPageView = useRef(false);
  const hasInitializedPixel = useRef(false);
  const [shouldLoadToaster, setShouldLoadToaster] = useState(false);
  const hideNavbar = location === "/checkout" || location === "/payment-gateway" || location === "/payment-result";
  const showClosedStoreBanner = !hideNavbar && company?.settings?.acceptOrders === false;
  const appFrameStyle = {
    "--closed-store-banner-height": showClosedStoreBanner ? "38px" : "0px",
  } as CSSProperties;

  useEffect(() => {
    if (hasInitializedPixel.current || typeof window === "undefined") return;
    let interactionCleanup = () => {};
    let fallbackTimeout = 0;

    const bootPixel = () => {
      if (hasInitializedPixel.current) return;
      hasInitializedPixel.current = true;
      interactionCleanup();
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
      initFacebookPixel();
    };

    const setupDeferredBoot = () => {
      const interactionEvents: Array<keyof WindowEventMap> = [
        "pointerdown",
        "keydown",
        "touchstart",
        "scroll",
      ];

      const onInteraction = (event: Event) => {
        if (!isMeaningfulInteraction(event)) return;
        bootPixel();
      };

      interactionEvents.forEach((eventName) => {
        window.addEventListener(eventName, onInteraction, {
          passive: true,
          once: true,
        });
      });

      interactionCleanup = () => {
        interactionEvents.forEach((eventName) => {
          window.removeEventListener(eventName, onInteraction);
        });
      };

      // Fallback para sesiones sin interacción.
      fallbackTimeout = window.setTimeout(bootPixel, 8000);
    };

    if (document.readyState === "complete") {
      setupDeferredBoot();
      return () => {
        interactionCleanup();
        if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
      };
    }

    const onLoad = () => setupDeferredBoot();

    window.addEventListener("load", onLoad, { once: true });
    return () => {
      window.removeEventListener("load", onLoad);
      interactionCleanup();
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
    };
  }, []);

  useEffect(() => {
    if (shouldLoadToaster || typeof window === "undefined") return;

    let fallbackTimeout = 0;
    const interactionEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];

    const loadToaster = () => {
      setShouldLoadToaster(true);
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadToaster);
      });
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
    };

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, loadToaster, { passive: true, once: true });
    });

    fallbackTimeout = window.setTimeout(loadToaster, 10000);

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, loadToaster);
      });
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
    };
  }, [shouldLoadToaster]);

  useEffect(() => {
    if (!hasTrackedInitialPageView.current) {
      hasTrackedInitialPageView.current = true;
      return;
    }

    if (typeof window.fbq !== "function") return;

    window.fbq("track", "PageView");
  }, [location]);

  return (
    <div
      className="relative min-h-screen text-foreground selection:bg-[#5A3F73] selection:text-white"
      style={appFrameStyle}
    >
      <div className="relative z-10">
        {showClosedStoreBanner ? (
          <div className="fixed left-0 top-0 z-[70] flex h-[38px] w-full items-center justify-center bg-red-700 px-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white shadow-md ring-1 ring-red-900/20">
            Tienda cerrada temporalmente
          </div>
        ) : null}
        {!hideNavbar && <Navbar />}
        <Suspense fallback={fallback}>
          <Routes />
        </Suspense>
      </div>
      <FloatingWhatsApp />
      {shouldLoadToaster ? (
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      ) : null}
    </div>
  );
}
