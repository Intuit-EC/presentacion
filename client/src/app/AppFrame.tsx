import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type ComponentType, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { useCompany } from "@/hooks/useCompany";

const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })),
);
const FloatingWhatsApp = lazy(() =>
  import("@/components/FloatingWhatsApp").then((module) => ({ default: module.FloatingWhatsApp })),
);

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

interface AppFrameProps {
  Routes: ComponentType;
  fallback?: ReactNode;
}

export function AppFrame({ Routes, fallback = <RouteFallback /> }: AppFrameProps) {
  const [location] = useLocation();
  const hasTrackedInitialPageView = useRef(false);
  const hasInitializedPixel = useRef(false);
  const [shouldLoadToaster, setShouldLoadToaster] = useState(false);
  const [shouldFetchCompany, setShouldFetchCompany] = useState(false);
  const [shouldLoadFloatingWhatsApp, setShouldLoadFloatingWhatsApp] = useState(false);
  const hideNavbar = location === "/checkout" || location === "/payment-gateway" || location === "/payment-result";
  const { data: company } = useCompany(shouldFetchCompany && !hideNavbar);
  const showClosedStoreBanner = !hideNavbar && company?.settings?.acceptOrders === false;
  const appFrameStyle = {
    "--closed-store-banner-height": showClosedStoreBanner ? "38px" : "0px",
  } as CSSProperties;

  useEffect(() => {
    if (hasInitializedPixel.current || typeof window === "undefined") return;
    let interactionCleanup = () => {};
    let fallbackTimeout = 0;
    let interactionTimeout = 0;
    let idleCallbackId = 0;

    const bootPixel = async () => {
      if (hasInitializedPixel.current) return;
      hasInitializedPixel.current = true;
      interactionCleanup();
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
      if (interactionTimeout) window.clearTimeout(interactionTimeout);
      if (idleCallbackId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
      const { initFacebookPixel } = await import("@/lib/facebook-pixel");
      initFacebookPixel();
    };

    const bootPixelWhenIdle = () => {
      if (hasInitializedPixel.current) return;

      if ("requestIdleCallback" in window) {
        idleCallbackId = window.requestIdleCallback(bootPixel, { timeout: 3000 });
        return;
      }

      bootPixel();
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
        if (interactionTimeout || hasInitializedPixel.current) return;
        interactionTimeout = window.setTimeout(bootPixelWhenIdle, 1200);
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

      // Fallback para sesiones sin interacción: después de cargar y con tiempo ocioso.
      fallbackTimeout = window.setTimeout(bootPixelWhenIdle, 4500);
    };

    if (document.readyState === "complete") {
      setupDeferredBoot();
      return () => {
        interactionCleanup();
        if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
        if (interactionTimeout) window.clearTimeout(interactionTimeout);
        if (idleCallbackId && "cancelIdleCallback" in window) {
          window.cancelIdleCallback(idleCallbackId);
        }
      };
    }

    const onLoad = () => setupDeferredBoot();

    window.addEventListener("load", onLoad, { once: true });
    return () => {
      window.removeEventListener("load", onLoad);
      interactionCleanup();
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
      if (interactionTimeout) window.clearTimeout(interactionTimeout);
      if (idleCallbackId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
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
    if (shouldFetchCompany || hideNavbar || typeof window === "undefined") return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let idleCallbackId = 0;

    const enableCompany = () => {
      setShouldFetchCompany(true);
    };

    const scheduleCompanyFetch = () => {
      if ("requestIdleCallback" in window) {
        idleCallbackId = window.requestIdleCallback(enableCompany, { timeout: 3500 });
        return;
      }

      timeoutId = globalThis.setTimeout(enableCompany, 1800);
    };

    if (document.readyState === "complete") {
      scheduleCompanyFetch();
    } else {
      window.addEventListener("load", scheduleCompanyFetch, { once: true });
    }

    return () => {
      window.removeEventListener("load", scheduleCompanyFetch);
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleCallbackId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [hideNavbar, shouldFetchCompany]);

  useEffect(() => {
    if (shouldLoadFloatingWhatsApp || hideNavbar || typeof window === "undefined") return;

    const enableFloatingWhatsApp = () => {
      setShouldLoadFloatingWhatsApp(true);
    };

    const interactionEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    const onInteraction = (event: Event) => {
      if (!isMeaningfulInteraction(event)) return;
      enableFloatingWhatsApp();
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onInteraction);
      });
    };

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, onInteraction, {
        passive: true,
        once: true,
      });
    });

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onInteraction);
      });
    };
  }, [hideNavbar, shouldLoadFloatingWhatsApp]);

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
      {shouldLoadFloatingWhatsApp ? (
        <Suspense fallback={null}>
          <FloatingWhatsApp />
        </Suspense>
      ) : null}
      {shouldLoadToaster ? (
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      ) : null}
    </div>
  );
}
