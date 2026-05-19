import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Seo } from "@/components/Seo";

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

type GatewayState = "preparing" | "ready" | "error";

function ensureStylesheet(href: string) {
  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function ensureScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar el SDK de PayPhone.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("No se pudo cargar el SDK de PayPhone."));
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

  useEffect(() => {
    const rawPayload = localStorage.getItem(PAYPHONE_BOX_STORAGE_KEY);
    if (!rawPayload) {
      setGatewayState("error");
      setErrorMessage("No se encontraron datos del pago. Vuelve al checkout.");
      return;
    }

    const preparePaymentBox = async () => {
      try {
        const checkoutPayload = JSON.parse(rawPayload);

        const response = await fetch("/api/payphone-web/box-prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkoutPayload),
        });

        const result = await response.json();
        if (!response.ok || result.status !== "success") {
          throw new Error(result.message || "No se pudo preparar el botón de pago.");
        }

        localStorage.setItem("pp_clientTxId", result.data.clientTransactionId);
        const webToken = String(result.data.paymentBoxData?.token || "");
        sessionStorage.setItem("pp_web_token", webToken);
        localStorage.setItem("pp_web_token", webToken);

        setReference(result.data.reference || "");
        setClientTransactionId(result.data.clientTransactionId || "");
        setWidgetPayload(result.data.paymentBoxData);
        setGatewayState("ready");
      } catch (error) {
        setGatewayState("error");
        setErrorMessage(error instanceof Error ? error.message : "Error al preparar el pago.");
      }
    };

    preparePaymentBox();
  }, []);

  useEffect(() => {
    if (!widgetPayload) return;

    let cancelled = false;

    const initializePayPhoneBox = async () => {
      if (cancelled) return;

      try {
        ensureStylesheet(PAYPHONE_CSS_URL);
        await ensureScript(PAYPHONE_SDK_URL);
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
      if (container) {
        container.innerHTML = "";
      }

      const payphoneBox = new PayphoneButtonBox(widgetPayload);
      payphoneBox.render("pp-button");
    };

    initializePayPhoneBox();

    return () => {
      cancelled = true;
      const container = document.getElementById("pp-button");
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [widgetPayload]);

  const goBackToCheckout = () => {
    localStorage.removeItem(PAYPHONE_BOX_STORAGE_KEY);
    localStorage.removeItem("pp_clientTxId");
    localStorage.removeItem("pp_web_token");
    sessionStorage.removeItem("pp_web_token");
    setLocation("/checkout");
  };

  if (gatewayState === "preparing") {
    return (
      <div className="min-h-screen bg-[#3D2852] flex items-center justify-center px-6">
        <Seo
          title="Preparando pago | DIFIORI"
          description="Preparando el botón de pago PayPhone."
          path="/payment-gateway"
          robots="noindex, nofollow"
        />
        <div className="text-center text-white max-w-md">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-[#D8C3F0]" />
          <h2 className="text-3xl font-serif font-bold mb-3">Preparando tu pago</h2>
          <p className="text-[#E6E6E6]/70">Generando la sesión segura del Payment Box desde la web.</p>
        </div>
      </div>
    );
  }

  if (gatewayState === "error") {
    return (
      <div className="min-h-screen bg-[#3D2852] flex items-center justify-center px-6">
        <Seo
          title="Error de pago | DIFIORI"
          description="No se pudo preparar el Payment Box."
          path="/payment-gateway"
          robots="noindex, nofollow"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#2A1B38]/85 backdrop-blur-3xl p-10 rounded-[2.5rem] shadow-2xl border border-red-500/25 text-center max-w-lg w-full"
        >
          <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-5" />
          <h2 className="text-3xl font-serif font-bold text-[#E6E6E6] mb-3">No se pudo iniciar el pago</h2>
          <p className="text-[#E6E6E6]/70 text-sm mb-8">{errorMessage}</p>
          <button
            onClick={goBackToCheckout}
            className="w-full bg-[#5A3F73] hover:bg-[#4A3362] text-white py-4 rounded-3xl font-black text-base transition-all shadow-xl"
          >
            Volver al checkout
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#3D2852] flex items-center justify-center px-6 py-12">
      <Seo
        title="Pago con tarjeta | DIFIORI"
        description="Completa tu pago con PayPhone."
        path="/payment-gateway"
        robots="noindex, nofollow"
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#2A1B38]/85 backdrop-blur-3xl p-10 rounded-[2.5rem] shadow-2xl border border-[#5A3F73]/35 w-full max-w-2xl"
      >
        <div className="text-center text-white mb-8">
          <h1 className="text-3xl font-serif font-bold mb-2">Pago con tarjeta</h1>
          <p className="text-[#E6E6E6]/70">
            Completa tu pago con PayPhone desde esta misma página.
          </p>
          {reference ? <p className="text-[#D8C3F0] font-semibold mt-4">{reference}</p> : null}
          {clientTransactionId ? (
            <p className="text-[#E6E6E6]/45 text-xs mt-1 break-all">{clientTransactionId}</p>
          ) : null}
        </div>

        <div id="pp-button" className="min-h-[180px]" />

        <button
          onClick={goBackToCheckout}
          className="mt-8 w-full border border-[#5A3F73]/40 text-[#E6E6E6] py-4 rounded-3xl font-bold text-sm transition-all hover:border-[#5A3F73] hover:bg-[#5A3F73]/10"
        >
          Volver al checkout
        </button>
      </motion.div>
    </div>
  );
}
