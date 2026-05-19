import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useCart } from "@/context/CartContext";
import { apiUrl } from "@/lib/api-url";

type ResultStatus = "loading" | "success" | "failed" | "cancelled" | "error";

const PAYMENT_CONFIRM_TIMEOUT_MS = 60000;

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

    const finalizePayphoneOrder = async (payload: Record<string, unknown>) => {
      return fetchJsonWithTimeout("/api/payphone-web/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    };

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

    const confirmWebBoxInBrowser = async () => {
      if (!payphoneId || transactionStatus === "CANCELLED") {
        return finalizePayphoneOrder({
          id: payphoneId,
          clientTransactionId: finalClientTxId,
          transactionStatus: "CANCELLED",
        });
      }

      const webToken =
        sessionStorage.getItem("pp_web_token") ||
        localStorage.getItem("pp_web_token");
      if (!webToken) {
        throw new Error("No se encontró el token web de PayPhone para confirmar el pago.");
      }

      const confirmData = await fetchJsonWithTimeout(
        "https://pay.payphonetodoesposible.com/api/button/V2/Confirm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${webToken}`,
          },
          body: JSON.stringify({
            id: Number(payphoneId),
            clientTxId: finalClientTxId,
          }),
        },
      );

      return finalizePayphoneOrder({
        id: payphoneId,
        clientTransactionId: finalClientTxId,
        transactionStatus: confirmData.transactionStatus,
        amount: confirmData.amount,
        authorizationCode: confirmData.authorizationCode,
      });
    };

    const confirmOrder = async () => {
      try {
        if (!finalClientTxId) {
          setStatus("error");
          return;
        }

        const isPaypalFlow =
          provider === "paypal" || Boolean(paypalOrderId) || paypalStatus === "cancelled";
        const data = isPaypalFlow
          ? await capturePaypalOrder()
          : await confirmWebBoxInBrowser();

        if (data.status !== "success") {
          setStatus("error");
          return;
        }

        const ps = data.data?.paymentStatus;
        setOrderNumber(data.data?.orderNumber || data.data?.reference || finalClientTxId || "");

        if (ps === "PAID") {
          setStatus("success");
          clearCart();
          if (!isPaypalFlow) clearPayphoneDraft();
        } else if (ps === "CANCELLED") {
          setStatus("cancelled");
          if (!isPaypalFlow) clearPayphoneDraft();
        } else {
          if (data.data?.emailMismatch) {
            setResultMessage(
              "El correo de PayPal que pago no coincide con el correo ingresado en el checkout."
            );
          }
          setStatus("failed");
          if (!isPaypalFlow) clearPayphoneDraft();
        }
      } catch (error) {
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
      <div className="min-h-screen bg-[#3D2852] flex items-center justify-center">
        <Seo
          title="Resultado de pago | DIFIORI"
          description="Resultado del proceso de pago."
          path="/payment-result"
          robots="noindex, nofollow"
        />
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-[#5A3F73]" />
          <p className="font-bold text-lg">Confirmando tu pago...</p>
          <p className="text-[#E6E6E6]/40 text-sm mt-2">Por favor no cierres esta ventana</p>
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
      <div className="min-h-screen bg-[#3D2852] flex items-center justify-center px-6">
        <Seo
          title="Pago cancelado | DIFIORI"
          description="Resultado del proceso de pago."
          path="/payment-result"
          robots="noindex, nofollow"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#2A1B38]/80 backdrop-blur-3xl p-14 rounded-[3rem] shadow-2xl border-2 border-[#5A3F73]/40 text-center max-w-lg w-full"
        >
          <XCircle className="w-24 h-24 text-yellow-400 mx-auto mb-6" />
          <h2 className="text-3xl font-serif font-bold text-[#E6E6E6] mb-3">Pago cancelado</h2>
          <p className="text-[#E6E6E6]/60 text-sm mb-8">
            Cancelaste el proceso de pago. Tu pedido no fue completado.
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
    <div className="min-h-screen bg-[#3D2852] flex items-center justify-center px-6">
      <Seo
        title="Error de pago | DIFIORI"
        description="Resultado del proceso de pago."
        path="/payment-result"
        robots="noindex, nofollow"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#2A1B38]/80 backdrop-blur-3xl p-14 rounded-[3rem] shadow-2xl border-2 border-red-500/30 text-center max-w-lg w-full"
      >
        <XCircle className="w-24 h-24 text-red-400 mx-auto mb-6" />
        <h2 className="text-3xl font-serif font-bold text-[#E6E6E6] mb-3">
          {status === "failed" ? "Pago rechazado" : "Error en el pago"}
        </h2>
        <p className="text-[#E6E6E6]/60 text-sm mb-8">
          {status === "failed" ? (
            resultMessage || "Tu tarjeta fue rechazada. Verifica los datos o intenta con otra tarjeta."
          ) : (
            resultMessage || "Ocurrió un error al procesar el pago. Por favor contáctanos."
          )}
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/checkout">
            <button className="w-full bg-[#5A3F73] hover:bg-[#4A3362] text-white py-5 rounded-3xl font-black text-base transition-all shadow-xl">
              Intentar de nuevo
            </button>
          </Link>
          <Link href="/">
            <button className="w-full bg-transparent border border-[#5A3F73]/40 text-[#E6E6E6]/60 py-4 rounded-3xl font-bold text-sm transition-all hover:border-[#5A3F73]">
              Volver a la tienda
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
