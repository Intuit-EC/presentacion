import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ShieldCheck, CreditCard, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Seo } from "@/components/Seo";
import { DEFAULT_COMPANY } from "@/lib/site";

declare global {
  interface Window {
    PPaymentButtonBox?: new (options: Record<string, unknown>) => {
      render: (elementId: string) => void;
    };
  }
}

const PAYPHONE_BOX_STORAGE_KEY = "pp_box_payload";
const PAYPHONE_SDK_URL = "https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.js";
const PAYPHONE_CSS_URL = "https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.css";
const PAYMENT_PREPARE_TIMEOUT_MS = 20000;
const SDK_LOAD_TIMEOUT_MS = 15000;
const WIDGET_RENDER_TIMEOUT_MS = 15000;

type GatewayState = "preparing" | "loading-widget" | "ready" | "error";

function ensureStylesheet(href: string) {
  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function ensureScript(src: string, timeoutMs = SDK_LOAD_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    let timeoutId = window.setTimeout(() => {
      reject(new Error("La pasarela está tardando demasiado en cargar. Intenta nuevamente."));
    }, timeoutMs);
    const finish = (callback: () => void) => {
      window.clearTimeout(timeoutId);
      callback();
    };
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true" || window.PPaymentButtonBox) {
        finish(resolve);
        return;
      }

      existing.addEventListener("load", () => finish(resolve), { once: true });
      existing.addEventListener("error", () => finish(() => reject(new Error("No se pudo cargar el SDK de PayPhone."))), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      finish(resolve);
    };
    script.onerror = () => finish(() => reject(new Error("No se pudo cargar el SDK de PayPhone.")));
    document.head.appendChild(script);
  });
}

export default function PaymentGateway() {
  const [, setLocation] = useLocation();
  const [gatewayState, setGatewayState] = useState<GatewayState>("preparing");
  const [errorMessage, setErrorMessage] = useState("");
  const [widgetPayload, setWidgetPayload] = useState<Record<string, unknown> | null>(null);
  const [reference, setReference] = useState("");
  const [clientTransactionId, setClientTransactionId] = useState("");
  const [widgetAttempt, setWidgetAttempt] = useState(0);

  useEffect(() => {
    const rawPayload = localStorage.getItem(PAYPHONE_BOX_STORAGE_KEY);
    if (!rawPayload) {
      setGatewayState("error");
      setErrorMessage("No se encontraron datos del pago. Vuelve al checkout.");
      return;
    }

    const preparePaymentBox = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), PAYMENT_PREPARE_TIMEOUT_MS);
      try {
        const checkoutPayload = JSON.parse(rawPayload);

        const response = await fetch("/api/payphone-web/box-prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkoutPayload),
          signal: controller.signal,
        });

        const rawResult = await response.text();
        let result: any;
        try {
          result = rawResult ? JSON.parse(rawResult) : {};
        } catch {
          throw new Error("La pasarela devolvió una respuesta inválida. Intenta nuevamente.");
        }
        if (!response.ok || result.status !== "success") {
          throw new Error(result.message || "No se pudo preparar el botón de pago.");
        }

        localStorage.setItem("pp_clientTxId", result.data.clientTransactionId);
        const webToken = String(result.data.paymentBoxData?.token || "");
        sessionStorage.setItem("pp_web_token", webToken);
        localStorage.setItem("pp_web_token", webToken);

        setReference(result.data.reference || "");
        setClientTransactionId(result.data.clientTransactionId || "");
        setGatewayState("loading-widget");
        setWidgetPayload(result.data.paymentBoxData);
      } catch (error) {
        setGatewayState("error");
        setErrorMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? "La preparación del pago tardó demasiado. Revisa tu conexión e intenta nuevamente."
            : error instanceof Error ? error.message : "Error al preparar el pago.",
        );
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    preparePaymentBox();
  }, []);

  useEffect(() => {
    if (!widgetPayload) return;

    let cancelled = false;
    let renderTimeoutId = 0;
    let observer: MutationObserver | null = null;

    const initializePayPhoneBox = async () => {
      if (cancelled) return;

      try {
        ensureStylesheet(PAYPHONE_CSS_URL);
        await ensureScript(PAYPHONE_SDK_URL);
        if (cancelled) return;
      } catch (error) {
        setGatewayState("error");
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el SDK de PayPhone.");
        return;
      }

      const PayphoneButtonBox = window.PPaymentButtonBox;
      if (!PayphoneButtonBox) {
        setGatewayState("error");
        setErrorMessage("No se pudo cargar el SDK de PayPhone.");
        return;
      }

      const container = document.getElementById("pp-button");
      if (!container) {
        setGatewayState("error");
        setErrorMessage("No se encontró el espacio para mostrar el formulario de pago.");
        return;
      }
      container.innerHTML = "";

      const markWidgetReady = () => {
        if (cancelled || !container.childElementCount) return;
        window.clearTimeout(renderTimeoutId);
        observer?.disconnect();
        setGatewayState("ready");
      };

      observer = new MutationObserver(markWidgetReady);
      observer.observe(container, { childList: true, subtree: true });
      renderTimeoutId = window.setTimeout(() => {
        if (cancelled) return;
        observer?.disconnect();
        setGatewayState("error");
        setErrorMessage("PayPhone no pudo mostrar el formulario. Puedes reintentar sin perder los datos del pedido.");
      }, WIDGET_RENDER_TIMEOUT_MS);

      try {
        const payphoneBox = new PayphoneButtonBox(widgetPayload);
        payphoneBox.render("pp-button");
        markWidgetReady();
      } catch (error) {
        window.clearTimeout(renderTimeoutId);
        observer?.disconnect();
        setGatewayState("error");
        setErrorMessage(error instanceof Error ? error.message : "No se pudo mostrar el formulario de pago.");
      }
    };

    initializePayPhoneBox();

    return () => {
      cancelled = true;
      window.clearTimeout(renderTimeoutId);
      observer?.disconnect();
      const container = document.getElementById("pp-button");
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [widgetPayload, widgetAttempt]);

  const goBackToCheckout = () => {
    localStorage.removeItem(PAYPHONE_BOX_STORAGE_KEY);
    localStorage.removeItem("pp_clientTxId");
    localStorage.removeItem("pp_web_token");
    sessionStorage.removeItem("pp_web_token");
    setLocation("/checkout");
  };

  const retryGateway = () => {
    setErrorMessage("");
    if (widgetPayload) {
      setGatewayState("loading-widget");
      setWidgetAttempt((attempt) => attempt + 1);
      return;
    }
    window.location.reload();
  };

  if (gatewayState === "preparing") {
    return (
      <div className="min-h-screen bg-[#FBF7FD] flex items-center justify-center px-6">
        <Seo
          title="Preparando pago | DIFIORI"
          description="Preparando el botón de pago PayPhone."
          path="/payment-gateway"
          robots="noindex, nofollow"
        />
        <div className="rounded-[2rem] border border-[#E5D7EF] bg-white p-8 text-center text-[#4A3362] shadow-[0_22px_58px_rgba(74,51,98,0.09)] max-w-md">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-[#C6539B]" />
          <h2 className="text-3xl font-serif font-black mb-3">Preparando tu pago seguro</h2>
          <p className="text-[#4A3362]/75 font-bold">Estamos generando la sesión protegida. Normalmente toma pocos segundos.</p>
          <div className="mt-5 rounded-2xl bg-[#FBF7FD] px-4 py-3 text-sm font-black">
            No actualices la página; tus datos del pedido ya están guardados.
          </div>
        </div>
      </div>
    );
  }

  if (gatewayState === "error") {
    return (
      <div className="min-h-screen bg-[#FBF7FD] flex items-center justify-center px-6">
        <Seo
          title="Error de pago | DIFIORI"
          description="No se pudo preparar el Payment Box."
          path="/payment-gateway"
          robots="noindex, nofollow"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl border border-red-500/20 text-center max-w-lg w-full"
        >
          <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-5" />
          <h2 className="text-3xl font-serif font-bold text-foreground mb-3">No se pudo iniciar el pago</h2>
          <p className="text-foreground/70 text-sm mb-8">{errorMessage}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={retryGateway}
              className="w-full bg-[#5A3F73] hover:bg-[#4A3362] text-white py-4 rounded-3xl font-black text-base transition-all shadow-xl"
            >
              Reintentar pago
            </button>
            <a
              href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}?text=${encodeURIComponent("Hola, necesito ayuda con mi pago DIFIORI.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white py-4 rounded-3xl font-black text-base transition-all shadow-xl"
            >
              <MessageSquare className="h-4 w-4" />
              Ayuda por WhatsApp
            </a>
            <button
              onClick={goBackToCheckout}
              className="w-full border border-accent/25 text-accent py-4 rounded-3xl font-bold text-sm transition-all hover:bg-primary/30"
            >
              Volver al checkout
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF7FD] flex items-center justify-center px-6 py-12">
      <Seo
        title="Pago con tarjeta | DIFIORI"
        description="Completa tu pago con PayPhone."
        path="/payment-gateway"
        robots="noindex, nofollow"
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-2xl border border-[#E5D7EF] w-full max-w-2xl"
      >
        <div className="text-center text-[#4A3362] mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#4B1F6F] text-white shadow-lg shadow-[#4B1F6F]/20">
            <CreditCard className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-serif font-black mb-2">Pago con tarjeta</h1>
          <p className="text-[#4A3362]/75 font-bold">
            Completa tu pago con PayPhone desde esta página protegida.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {["Sesión segura", "Pedido guardado", "Soporte DIFIORI"].map((label) => (
              <span key={label} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E5D7EF] bg-[#FBF7FD] px-3 py-2 text-xs font-black text-[#4B1F6F]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#C6539B]" />
                {label}
              </span>
            ))}
          </div>
          {reference ? <p className="text-[#4B1F6F] font-black mt-4">{reference}</p> : null}
          {clientTransactionId ? (
            <p className="text-foreground/45 text-xs mt-1 break-all">{clientTransactionId}</p>
          ) : null}
        </div>

        <div className="relative min-h-[180px]">
          {gatewayState === "loading-widget" ? (
            <div className="absolute inset-0 z-10 flex min-h-[180px] flex-col items-center justify-center rounded-2xl bg-white text-center">
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-accent" />
              <p className="font-bold text-foreground">Cargando formulario seguro…</p>
              <p className="mt-1 text-sm text-foreground/60">La sesión ya fue creada; esperamos a PayPhone.</p>
            </div>
          ) : null}
          <div id="pp-button" className="min-h-[180px]" />
        </div>

        <button
          onClick={goBackToCheckout}
          className="mt-8 w-full border border-accent/30 text-accent py-4 rounded-3xl font-bold text-sm transition-all hover:border-accent hover:bg-primary/30"
        >
          Volver al checkout
        </button>
      </motion.div>
    </div>
  );
}
