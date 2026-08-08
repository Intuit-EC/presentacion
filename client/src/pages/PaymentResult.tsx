import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useCart } from "@/context/CartContext";
import { apiUrl } from "@/lib/api-url";
import { trackGaEvent } from "@/lib/analytics";
import { DEFAULT_COMPANY } from "@/lib/site";

type ResultStatus = "loading" | "success" | "failed" | "cancelled" | "error";

const PAYMENT_CONFIRM_TIMEOUT_MS = 25000;

async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = PAYMENT_CONFIRM_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const rawBody = await response.text();
    let data: any = {};

    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      data = { message: rawBody };
    }

    if (!response.ok) {
      throw new Error(data?.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La verificacion del pago tardo demasiado. Intenta revisar tu pedido o contactanos.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function PaymentResult() {
  const { clearCart } = useCart();
  const [status, setStatus] = useState<ResultStatus>("loading");
  const [orderNumber, setOrderNumber] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const confirmed = useRef(false);

  useEffect(() => {
    if (confirmed.current) return;
    confirmed.current = true;

    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    const payphoneId = params.get("id");
    const paypalOrderId = params.get("token");
    const paypalStatus = params.get("paypalStatus");
    const clientTransactionId = params.get("clientTransactionId");
    const transactionStatus = params.get("transactionStatus");
    const clearPayphoneDraft = () => {
      localStorage.removeItem("pp_clientTxId");
      localStorage.removeItem("pp_box_payload");
      localStorage.removeItem("pp_web_token");
      sessionStorage.removeItem("pp_web_token");
    };

    // Si no hay clientTransactionId en la URL, buscar en localStorage (fallback)
    const finalClientTxId = clientTransactionId || localStorage.getItem("pp_clientTxId");

    const capturePaypalOrder = async () => {
      return fetchJsonWithTimeout(apiUrl("/api/external/paypal/capture"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paypalOrderId,
          clientTransactionId: finalClientTxId,
          cancelled: paypalStatus === "cancelled",
        }),
      });
    };

    const confirmPayphoneOrder = async () => fetchJsonWithTimeout(
      "/api/payphone-web/confirm-and-finalize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payphoneId,
          clientTransactionId: finalClientTxId,
          transactionStatus,
        }),
      },
    );

    const confirmOrder = async () => {
      try {
        if (!finalClientTxId) {
          setResultMessage("No encontramos una sesión de pago activa. Vuelve al checkout e intenta nuevamente.");
          setStatus("error");
          return;
        }

        const isPaypalFlow =
          provider === "paypal" || Boolean(paypalOrderId) || paypalStatus === "cancelled";
        const data = isPaypalFlow
          ? await capturePaypalOrder()
          : await confirmPayphoneOrder();

        if (data.status !== "success") {
          setStatus("error");
          return;
        }

        const ps = data.data?.paymentStatus;
        setOrderNumber(data.data?.orderNumber || data.data?.reference || finalClientTxId || "");

        if (ps === "PAID") {
          trackGaEvent("purchase", {
            transaction_id: data.data?.orderNumber || data.data?.reference || finalClientTxId,
            currency: "USD",
            value: Number(data.data?.total || data.data?.amount || 0) || undefined,
            payment_method: isPaypalFlow ? "PayPal" : "Payphone",
          });
          setStatus("success");
          clearCart();
          if (!isPaypalFlow) clearPayphoneDraft();
        } else if (ps === "CANCELLED") {
          trackGaEvent("payment_error", {
            payment_method: isPaypalFlow ? "PayPal" : "Payphone",
            error_message: "payment_cancelled",
          });
          setStatus("cancelled");
          if (!isPaypalFlow) clearPayphoneDraft();
        } else {
          if (data.data?.emailMismatch) {
            setResultMessage(
              "El correo de PayPal que pago no coincide con el correo ingresado en el checkout."
            );
          }
          trackGaEvent("payment_error", {
            payment_method: isPaypalFlow ? "PayPal" : "Payphone",
            error_message: data.data?.emailMismatch ? "paypal_email_mismatch" : "payment_failed",
          });
          setStatus("failed");
          if (!isPaypalFlow) clearPayphoneDraft();
        }
      } catch (error) {
        trackGaEvent("payment_error", {
          error_message: error instanceof Error ? error.message : "payment_confirmation_error",
        });
        setStatus("error");
        setResultMessage(
          error instanceof Error
            ? error.message
            : "Ocurrió un error al confirmar el pago. Por favor intenta nuevamente."
        );
      }
    };

    confirmOrder();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#FBF7FD] flex items-center justify-center px-6">
        <Seo
          title="Resultado de pago | DIFIORI"
          description="Resultado del proceso de pago."
          path="/payment-result"
          robots="noindex, nofollow"
        />
        <div className="rounded-[2rem] border border-[#E5D7EF] bg-white p-8 text-center text-[#4A3362] shadow-[0_22px_58px_rgba(74,51,98,0.09)]">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-[#C6539B]" />
          <p className="font-black text-lg">Confirmando tu pago...</p>
          <p className="text-[#4A3362]/70 text-sm mt-2 font-bold">Por favor no cierres esta ventana.</p>
          <p className="mt-4 rounded-2xl bg-[#FBF7FD] px-4 py-3 text-xs font-black text-[#4A3362]">
            Estamos validando la transacción y protegiendo tu pedido.
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <Seo
          title="Pago exitoso | DIFIORI"
          description="Resultado del proceso de pago."
          path="/payment-result"
          robots="noindex, nofollow"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2rem] shadow-2xl border border-[#E5D7EF] text-center max-w-lg w-full sm:p-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <CheckCircle className="w-24 h-24 text-green-400 mx-auto mb-6" />
          </motion.div>
          <h2 className="text-3xl font-serif font-bold text-[#4A3362] mb-3">¡Pago exitoso!</h2>
          {orderNumber && (
            <p className="text-[#5A3F73] font-black text-lg mb-2">{orderNumber}</p>
          )}
          <p className="text-[#5A3F73] text-base font-semibold mb-8">
            Tu pago fue procesado correctamente. El vendedor se pondrá en contacto contigo. Esperamos tu respuesta.
          </p>
          <Link href="/">
            <button className="w-full bg-[#5A3F73] hover:bg-[#4A3362] text-white py-5 rounded-3xl font-black text-base transition-all shadow-xl">
              Volver a la tienda
            </button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="min-h-screen bg-[#FBF7FD] flex items-center justify-center px-6">
        <Seo
          title="Pago cancelado | DIFIORI"
          description="Resultado del proceso de pago."
          path="/payment-result"
          robots="noindex, nofollow"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-2xl border border-[#E5D7EF] text-center max-w-lg w-full"
        >
          <XCircle className="w-24 h-24 text-yellow-400 mx-auto mb-6" />
          <h2 className="text-3xl font-serif font-black text-[#4A3362] mb-3">Pago cancelado</h2>
          <p className="text-[#4A3362]/70 text-sm font-bold mb-8">
            Cancelaste el proceso de pago. Puedes volver al checkout y elegir otro método sin iniciar desde cero.
          </p>
          <Link href="/checkout">
            <button className="w-full bg-[#5A3F73] hover:bg-[#4A3362] text-white py-5 rounded-3xl font-black text-base transition-all shadow-xl">
              Volver al checkout
            </button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // failed o error
  return (
    <div className="min-h-screen bg-[#FBF7FD] flex items-center justify-center px-6">
      <Seo
        title="Error de pago | DIFIORI"
        description="Resultado del proceso de pago."
        path="/payment-result"
        robots="noindex, nofollow"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-2xl border border-red-500/20 text-center max-w-lg w-full"
      >
        <XCircle className="w-24 h-24 text-red-400 mx-auto mb-6" />
        <h2 className="text-3xl font-serif font-black text-[#4A3362] mb-3">
          {status === "failed" ? "Pago rechazado" : "Error en el pago"}
        </h2>
        <p className="text-[#4A3362]/70 text-sm font-bold mb-6">
          {status === "failed" ? (
            resultMessage || "Tu tarjeta fue rechazada. Verifica los datos o intenta con otra tarjeta."
          ) : (
            resultMessage || "Ocurrió un error al procesar el pago. Por favor contáctanos."
          )}
        </p>
        <p className="mb-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FBF7FD] px-4 py-3 text-xs font-black text-[#4A3362]">
          <ShieldCheck className="h-4 w-4 text-[#C6539B]" />
          Tu pedido no se pierde; podemos ayudarte a terminarlo.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/checkout">
            <button className="w-full bg-[#5A3F73] hover:bg-[#4A3362] text-white py-5 rounded-3xl font-black text-base transition-all shadow-xl">
              Intentar de nuevo
            </button>
          </Link>
          <a
            href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}?text=${encodeURIComponent("Hola, necesito ayuda para finalizar mi pago DIFIORI.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white py-5 rounded-3xl font-black text-base transition-all shadow-xl"
          >
            <MessageSquare className="h-4 w-4" />
            Ayuda por WhatsApp
          </a>
          <Link href="/">
            <button className="w-full bg-transparent border border-[#5A3F73]/25 text-[#4A3362] py-4 rounded-3xl font-bold text-sm transition-all hover:border-[#5A3F73]">
              Volver a la tienda
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
