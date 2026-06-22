import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingBag,
  ChevronLeft,
  CreditCard,
  Truck,
  User,
  CheckCircle,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Clock,
  MessageSquare,
  FileText,
  Landmark,
  Smartphone,
  Globe2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-url";
import { useCart } from "@/context/CartContext";
import { useCompany } from "@/hooks/useCompany";

import { CartDialog } from "@/components/CartDialog";
import { Seo } from "@/components/Seo";
import { DEFAULT_COMPANY } from "@/lib/site";

type OrderStatus = "idle" | "loading" | "success" | "error";
type PaymentMethod = "PayPal" | "Payphone" | "Banco" | "Zelle";
type SelectedPaymentMethod = PaymentMethod | "";
type CheckoutStep = "sender" | "receiver" | "payment";
type ShippingSectorRate = { sector: string; cost: number };
type CheckoutFocusable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const CHECKOUT_REQUEST_TIMEOUT_MS = 60000;
const PAYPAL_PROOF_UPLOAD_TIMEOUT_MS = 20000;

async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = CHECKOUT_REQUEST_TIMEOUT_MS,
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
      throw new Error("La solicitud tardo demasiado. Verifica tu conexion e intenta nuevamente.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timeoutId = 0;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeSectorName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const CHECKOUT_STEPS: {
  id: CheckoutStep;
  label: string;
  helper: string;
  Icon: typeof User;
}[] = [
  {
    id: "sender",
    label: "Tus datos",
    helper: "Quién envía",
    Icon: User,
  },
  {
    id: "receiver",
    label: "Entrega",
    helper: "Quién recibe",
    Icon: Truck,
  },
  {
    id: "payment",
    label: "Pago",
    helper: "Confirmación",
    Icon: CreditCard,
  },
];

const PAYMENT_METHODS: {
  label: PaymentMethod;
  description: string;
  Icon: typeof CreditCard;
}[] = [
  {
    label: "PayPal",
    description: "Pago internacional o con tarjeta de crédito",
    Icon: Globe2,
  },
  {
    label: "Payphone",
    description: "Pago local con tarjeta desde la pasarela segura",
    Icon: Smartphone,
  },
  {
    label: "Banco",
    description: "Transferencia bancaria con comprobante",
    Icon: Landmark,
  },
  {
    label: "Zelle",
    description: "Pago por Zelle; el vendedor confirmará los datos",
    Icon: CreditCard,
  },
];

const DEFAULT_TRANSFER_INSTRUCTIONS = `Banco Pichincha cta ahorro # 2202306049
Banco Pacifico cta ahorro # 0851179635
Banco Guayaquil cta ahorro # 1389429

Nombre: Maritza Iveth Medranda Flor
CI: 0910784024
Correo: ventas@difiori.com.ec`;

const DEFAULT_ZELLE_INSTRUCTIONS = `Correo Zelle: rosamoncada085@gmail.com
Titular: Roberto Rodriguez`;

function normalizeSectorRates(value: unknown): ShippingSectorRate[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const source = item && typeof item === "object" ? item : {};
      const sector = typeof (source as { sector?: unknown }).sector === "string"
        ? String((source as { sector?: unknown }).sector).trim()
        : "";
      const rawCost = (source as { cost?: unknown }).cost;
      const cost = Number(rawCost);

      if (!sector || !Number.isFinite(cost) || cost < 0) return null;

      return { sector, cost };
    })
    .filter((item): item is ShippingSectorRate => Boolean(item));
}

function resolveShippingCostBySector(
  sector: string,
  rates: ShippingSectorRate[]
) {
  const normalizedSector = normalizeSectorName(sector);
  if (!normalizedSector) {
    return { cost: 0, matchedSector: "", isMatched: false };
  }

  const exactMatch = rates.find(
    (item) => normalizeSectorName(item.sector) === normalizedSector
  );

  if (exactMatch) {
    return {
      cost: exactMatch.cost,
      matchedSector: exactMatch.sector,
      isMatched: true,
    };
  }

  const partialMatch = rates.find((item) => {
    const candidate = normalizeSectorName(item.sector);
    return normalizedSector.includes(candidate) || candidate.includes(normalizedSector);
  });

  if (partialMatch) {
    return {
      cost: partialMatch.cost,
      matchedSector: partialMatch.sector,
      isMatched: true,
    };
  }

  return { cost: 0, matchedSector: "", isMatched: false };
}

export default function Checkout() {
  useEffect(() => {
    void import("./checkout.css");
  }, []);

  const { items, cartTotal, clearCart, setIsCartOpen, isCartLoading } = useCart();
  const [, setLocation] = useLocation();
  const { data: company } = useCompany();
  const [activeStep, setActiveStep] = useState<CheckoutStep>("sender");
  const [paymentMethod, setPaymentMethod] = useState<SelectedPaymentMethod>("");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("idle");
  const [isCartOpening, setIsCartOpening] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [formRevision, setFormRevision] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [sectorInput, setSectorInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    percent_value: number;
    amount: number | null;
    type: string;
  } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofMessage, setProofMessage] = useState("");
  const [paypalPayerEmail, setPaypalPayerEmail] = useState("");
  const payphoneBoxStorageKey = "pp_box_payload";
  const checkoutWhatsappUrl = `https://wa.me/${DEFAULT_COMPANY.phoneDigits}?text=${encodeURIComponent(
    "Hola, necesito ayuda para completar mi pedido en DIFIORI."
  )}`;
  const transferInstructions =
    company?.settings?.paymentSettings?.transferInstructions ||
    DEFAULT_TRANSFER_INSTRUCTIONS;
  const acceptOrders = company?.settings?.acceptOrders !== false;
  const shippingSectorRates = useMemo(
    () => normalizeSectorRates(company?.settings?.paymentSettings?.shippingSectorRates),
    [company?.settings?.paymentSettings?.shippingSectorRates]
  );
  const hasConfiguredShippingSectors = shippingSectorRates.length > 0;
  const shippingResolution = useMemo(
    () => resolveShippingCostBySector(sectorInput, shippingSectorRates),
    [sectorInput, shippingSectorRates]
  );
  const receiverNameRef = useRef<HTMLInputElement>(null);
  const receiverPhoneRef = useRef<HTMLInputElement>(null);
  const senderNameRef = useRef<HTMLInputElement>(null);
  const senderEmailRef = useRef<HTMLInputElement>(null);
  const senderPhoneRef = useRef<HTMLInputElement>(null);
  const sectorSelectRef = useRef<HTMLSelectElement>(null);
  const sectorInputRef = useRef<HTMLInputElement>(null);
  const dateTimeRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const cardMessageRef = useRef<HTMLTextAreaElement>(null);
  const observationsRef = useRef<HTMLTextAreaElement>(null);

  const abandonmentSent = useRef(false);
  const orderItemsPayload = useMemo(
    () =>
      items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        productImage: item.product.image,
        quantity: item.quantity,
        price: item.product.price,
      })),
    [items]
  );

  const readCheckoutFields = () => {
    const senderName = senderNameRef.current?.value.trim() || "";
    const senderEmail = senderEmailRef.current?.value.trim() || "";
    const senderPhone = senderPhoneRef.current?.value.trim() || "";
    const receiverName = receiverNameRef.current?.value.trim() || "";
    const receiverPhone = receiverPhoneRef.current?.value.trim() || "";
    const deliveryDateTime = dateTimeRef.current?.value.trim() || "";
    const address = addressRef.current?.value.trim() || "";
    const cardMessage = cardMessageRef.current?.value.trim() || "";
    const observations = observationsRef.current?.value.trim() || "";
    const sector = sectorInput.trim();
    return {
      senderName,
      senderEmail,
      senderPhone,
      receiverName,
      receiverPhone,
      deliveryDateTime,
      address,
      sector,
      exactAddress: address,
      cardMessage,
      observations,
    };
  };

  const checkoutReadiness = useMemo(() => {
    const {
      senderName,
      senderEmail,
      senderPhone,
      receiverName,
      receiverPhone,
      deliveryDateTime,
      address,
      sector,
      cardMessage,
    } = readCheckoutFields();
    const hasValidSenderEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail);
    const senderComplete = Boolean(senderName && senderEmail && senderPhone && hasValidSenderEmail);
    const deliveryComplete = Boolean(
      receiverName &&
        receiverPhone &&
        (hasConfiguredShippingSectors ? sector : true) &&
        deliveryDateTime &&
        address &&
        cardMessage
    );

    return {
      senderComplete,
      deliveryComplete,
      hasDestination: Boolean(sector),
      canChoosePayment: senderComplete && deliveryComplete,
    };
  }, [formRevision, hasConfiguredShippingSectors, sectorInput]);

  const canConfirmOrder = items.length > 0 && checkoutReadiness.canChoosePayment && Boolean(paymentMethod);

  const updateCheckoutProgress = () => {
    setFormRevision((current) => current + 1);
  };

  useEffect(() => {
    const handleAbandonment = () => {
      if (
        abandonmentSent.current ||
        orderStatus === "success" ||
        items.length === 0
      ) {
        return;
      }

      const {
        senderName,
        senderEmail,
        senderPhone,
        receiverName,
        receiverPhone,
        deliveryDateTime,
        exactAddress,
        sector,
        cardMessage,
        observations,
      } = readCheckoutFields();

      if (senderName || senderPhone) {
        fetch(apiUrl("/api/external/store-orders/abandoned"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: senderName || "Cliente anonimo",
            phone: senderPhone || "No proporcionado",
            senderName: senderName || "",
            senderEmail: senderEmail || "",
            senderPhone: senderPhone || "",
            receiverName: receiverName || "",
            receiverPhone: receiverPhone || "",
            exactAddress: exactAddress || "",
            sector: sector || "Guayaquil",
            paymentMethod,
            deliveryDateTime: deliveryDateTime || "",
            cardMessage: cardMessage || "",
            observations: observations || "",
            couponCode: appliedCoupon?.code || "",
            abandonedAt: new Date().toISOString(),
            source: "CHECKOUT_WEB",
            storeUrl: window.location.origin,
            items: orderItemsPayload,
            total:
              cartTotal +
              shippingResolution.cost -
              (appliedCoupon
                ? appliedCoupon.type === "PERCENTAGE"
                  ? cartTotal * appliedCoupon.percent_value
                  : appliedCoupon.amount || 0
                : 0),
          }),
          keepalive: true,
        });
        abandonmentSent.current = true;
      }
    };

    const timer = setTimeout(handleAbandonment, 120000);
    window.addEventListener("beforeunload", handleAbandonment);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", handleAbandonment);
    };
  }, [orderItemsPayload, orderStatus, paymentMethod, appliedCoupon, cartTotal, shippingResolution.cost, sectorInput]);

  useEffect(() => {
    if (!checkoutReadiness.canChoosePayment && paymentMethod) {
      setPaymentMethod("");
    }
  }, [checkoutReadiness.canChoosePayment, paymentMethod]);

  const cartSubtotal = cartTotal;
  const shippingCost = shippingResolution.cost;
  const activeStepIndex = CHECKOUT_STEPS.findIndex(
    (step) => step.id === activeStep
  );

  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === "PERCENTAGE") {
      discountAmount = cartSubtotal * appliedCoupon.percent_value;
    } else if (appliedCoupon.amount) {
      discountAmount = appliedCoupon.amount;
    }
  }

  const finalTotal = cartSubtotal + shippingCost - discountAmount;
  const isCheckoutBusy = orderStatus === "loading";

  const focusCheckoutField = (
    step: CheckoutStep,
    fieldRef: React.RefObject<CheckoutFocusable | null>
  ) => {
    setActiveStep(step);
    window.setTimeout(() => {
      fieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      fieldRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  const scrollToCheckoutSection = (step: CheckoutStep) => {
    const target = document.getElementById(`checkout-${step}`);
    setActiveStep(step);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getMissingSenderFields = () => {
    const { senderName, senderEmail, senderPhone } = readCheckoutFields();
    return [
      [senderName, "nombre de quien envía"],
      [senderEmail, "correo de quien envía"],
      [senderPhone, "teléfono de quien envía"],
    ]
      .filter(([value]) => !value)
      .map(([, label]) => label);
  };

  const getMissingReceiverFields = () => {
    const {
      receiverName,
      receiverPhone,
      address,
      sector,
      cardMessage,
      deliveryDateTime,
    } = readCheckoutFields();
    return [
      [receiverName, "nombre de quien recibe"],
      [receiverPhone, "teléfono de quien recibe"],
      ...(hasConfiguredShippingSectors ? [[sector, "sector"] as const] : []),
      [deliveryDateTime, "hora de entrega"],
      [address, "dirección exacta"],
      [cardMessage, "mensaje para la tarjeta"],
    ]
      .filter(([value]) => !value)
      .map(([, label]) => label);
  };

  const validateSenderStep = () => {
    const { senderName, senderEmail, senderPhone } = readCheckoutFields();
    const missingFields = getMissingSenderFields();

    if (missingFields.length > 0) {
      setErrorMsg(`Completa: ${missingFields.join(", ")}.`);
      if (!senderName) {
        focusCheckoutField("sender", senderNameRef);
      } else if (!senderEmail) {
        focusCheckoutField("sender", senderEmailRef);
      } else if (!senderPhone) {
        focusCheckoutField("sender", senderPhoneRef);
      }
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      setErrorMsg("Ingresa un correo válido para quien envía.");
      focusCheckoutField("sender", senderEmailRef);
      return false;
    }

    setErrorMsg("");
    return true;
  };

  const validateReceiverStep = () => {
    const {
      receiverName,
      receiverPhone,
      address,
      sector,
      cardMessage,
      deliveryDateTime,
    } = readCheckoutFields();
    const missingFields = getMissingReceiverFields();

    if (missingFields.length > 0) {
      setErrorMsg(`Completa: ${missingFields.join(", ")}.`);
      if (!receiverName) {
        focusCheckoutField("receiver", receiverNameRef);
      } else if (!receiverPhone) {
        focusCheckoutField("receiver", receiverPhoneRef);
      } else if (!sector) {
        focusCheckoutField("receiver", hasConfiguredShippingSectors ? sectorSelectRef : sectorInputRef);
      } else if (!deliveryDateTime) {
        focusCheckoutField("receiver", dateTimeRef);
      } else if (!address) {
        focusCheckoutField("receiver", addressRef);
      } else if (!cardMessage) {
        focusCheckoutField("receiver", cardMessageRef);
      }
      return false;
    }

    setErrorMsg("");
    return true;
  };

  const handleStepChange = (targetStep: CheckoutStep) => {
    if (isCheckoutBusy || targetStep === activeStep) return;

    if (targetStep === "sender") {
      scrollToCheckoutSection("sender");
      setErrorMsg("");
      return;
    }

    if (targetStep === "receiver") {
      if (validateSenderStep()) {
        scrollToCheckoutSection("receiver");
        setErrorMsg("");
      }
      return;
    }

    if (targetStep === "payment") {
      if (validateSenderStep() && validateReceiverStep()) {
        scrollToCheckoutSection("payment");
        setErrorMsg("");
      }
    }
  };

  const handleOpenCart = () => {
    if (isCartOpening || isCheckoutBusy) return;
    setIsCartOpening(true);
    window.setTimeout(() => {
      setIsCartOpen(true);
      setIsCartOpening(false);
    }, 180);
  };

  const handleValidateCoupon = async () => {
    if (!couponCode) return;
    setIsValidatingCoupon(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/checkout/get-coupon-discount?code=${couponCode}`
      );
      const data = await res.json();
      if (res.ok && data.status === "success") {
        const coupon = data.data;
        if (coupon.minAmount && cartSubtotal < coupon.minAmount) {
          setErrorMsg(
            `El cupón requiere una compra mínima de $${coupon.minAmount}`
          );
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon(coupon);
        }
      } else {
        setErrorMsg(data.message || "Cupón no válido");
        setAppliedCoupon(null);
      }
    } catch {
      setErrorMsg("Error al validar el cupón");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (isCheckoutBusy) return;
    if (!acceptOrders) {
      setOrderStatus("error");
      setErrorMsg("Tienda cerrada temporalmente");
      return;
    }

    const {
      senderName,
      senderEmail,
      senderPhone,
      receiverName,
      receiverPhone,
      deliveryDateTime,
      address,
      exactAddress,
      sector,
      cardMessage,
      observations,
    } = readCheckoutFields();

    if (!validateSenderStep() || !validateReceiverStep()) return;

    if (!paymentMethod) {
      setErrorMsg("Selecciona un método de pago para continuar.");
      scrollToCheckoutSection("payment");
      return;
    }

    setErrorMsg("");
    setOrderStatus("loading");
    abandonmentSent.current = true;

    const firstItem = items[0];
    const orderPayload = {
      productId: firstItem?.product.id,
      productName: firstItem?.product.name,
      productPrice: firstItem?.product.price,
      quantity: firstItem?.quantity || 1,
      items: orderItemsPayload,
      receiverName,
      senderName,
      senderEmail,
      senderPhone,
      receiverPhone,
      phone: senderPhone,
      deliveryDateTime,
      exactAddress,
      sector,
      shippingCost,
      cardMessage,
      observations,
      total: finalTotal,
      couponCode: appliedCoupon?.code || null,
      storeUrl: window.location.origin,
    };

    try {
      if (paymentMethod === "Payphone") {
        localStorage.setItem(
          payphoneBoxStorageKey,
          JSON.stringify({
            ...orderPayload,
            callbackUrl: `${window.location.origin}/payment-result`,
            cancellationUrl: `${window.location.origin}/checkout`,
          })
        );
        setLocation("/payment-gateway");
        return;
      }

      if (paymentMethod === "PayPal") {
        const normalizedPaypalEmail = paypalPayerEmail.trim().toLowerCase();
        if (!normalizedPaypalEmail) {
          throw new Error("Ingresa el correo de la cuenta PayPal que usaras para pagar.");
        }

        // Validar correo de PayPal si se proporcionó
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPaypalEmail)) {
          throw new Error("El correo de PayPal no tiene un formato válido.");
        }

        const result = await fetchJsonWithTimeout(apiUrl("/api/external/paypal/create-order"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...orderPayload,
            paymentMethod,
            paypalPayerEmail: normalizedPaypalEmail,
            callbackUrl: `${window.location.origin}/payment-result?provider=paypal`,
            cancellationUrl: `${window.location.origin}/payment-result?provider=paypal`,
          }),
        });

        if (result.status !== "success") {
          const errorMessage = result.message || "No se pudo iniciar el pago con PayPal.";

          // Mensajes específicos para errores comunes de PayPal
          if (errorMessage.includes("correo") || errorMessage.includes("email")) {
            throw new Error(`Error con el correo de PayPal: ${errorMessage}`);
          } else if (errorMessage.includes("tiempo de espera") || errorMessage.includes("timeout")) {
            throw new Error("PayPal está tardando en responder. Verifica tu conexión e intenta nuevamente.");
          } else if (errorMessage.includes("credenciales") || errorMessage.includes("Client ID")) {
            throw new Error("Hay un problema técnico con PayPal. Contáctanos por WhatsApp para procesar tu pago.");
          }

          throw new Error(errorMessage);
        }

        const createdOrderNumber = result.data?.orderNumber || "DIFIORI-OK";
        const approveUrl = String(result.data?.approveUrl || "").trim();

        setOrderNumber(createdOrderNumber);

        // Subir comprobante ANTES de redirigir a PayPal
        if (selectedProofFile) {
          try {
            await withTimeout(
              uploadPaymentProofForOrder(createdOrderNumber, selectedProofFile),
              PAYPAL_PROOF_UPLOAD_TIMEOUT_MS,
              "La subida del comprobante tardo demasiado."
            );
          } catch (uploadError) {
            console.warn("Error subiendo comprobante, pero continuando con PayPal:", uploadError);
            // No lanzamos error aquí para no bloquear el pago con PayPal
          }
        }

        if (!approveUrl) {
          throw new Error("PayPal no devolvio una URL de aprobacion.");
        }

        window.location.assign(approveUrl);
        return;
      }

      const data = await fetchJsonWithTimeout(apiUrl("/api/external/store-orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...orderPayload, paymentMethod }),
      });

      if (data.status === "success") {
        const createdOrderNumber = data.data?.orderNumber || "DIFIORI-OK";
        setOrderNumber(createdOrderNumber);
        setOrderStatus("success");
        if (
          (paymentMethod === "Banco" ||
            paymentMethod === "Zelle" ||
            paymentMethod === "PayPal") &&
          selectedProofFile
        ) {
          await uploadPaymentProofForOrder(
            createdOrderNumber,
            selectedProofFile
          );
        }
        clearCart();
      } else {
        setErrorMsg(
          data.message ||
            "Hubo un error al procesar tu orden. Contáctanos por WhatsApp."
        );
        setOrderStatus("error");
        abandonmentSent.current = false;
      }
    } catch (error) {
      console.error("Error en checkout:", error);
      setOrderStatus("error");
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Hubo un error inesperado. Contáctanos por WhatsApp."
      );
      abandonmentSent.current = false;
    }
  };

  const uploadPaymentProofForOrder = async (
    targetOrderNumber: string,
    proofFile: File
  ) => {
    if (!targetOrderNumber || !proofFile) {
      setProofMessage("Selecciona una imagen del comprobante antes de subir.");
      return;
    }

    setIsUploadingProof(true);
    setProofMessage("");

    try {
      const dataUrl = await readFileAsDataUrl(proofFile);
      const data = await fetchJsonWithTimeout(
        apiUrl(`/api/external/store-orders/${encodeURIComponent(targetOrderNumber)}/payment-proof`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: proofFile.name,
            mimeType: proofFile.type,
            dataUrl,
          }),
        }
      );

      if (data.status !== "success") {
        throw new Error(data.message || "No se pudo subir el comprobante");
      }

      setProofMessage(
        "Comprobante subido. El equipo lo revisará desde el admin."
      );
      setSelectedProofFile(null);
    } catch (error) {
      setProofMessage(
        error instanceof Error
          ? error.message
          : "No se pudo subir el comprobante"
      );
    } finally {
      setIsUploadingProof(false);
    }
  };

  const uploadPaymentProof = async () => {
    if (!orderNumber || !selectedProofFile) {
      setProofMessage("Selecciona una imagen del comprobante antes de subir.");
      return;
    }

    await uploadPaymentProofForOrder(orderNumber, selectedProofFile);
  };

  if (isCartLoading) {
    return (
      <div className="checkout-shell flex min-h-screen items-center justify-center bg-white px-6">
        <Seo
          title="Cargando carrito | DIFIORI"
          description="Cargando el carrito antes de continuar con el checkout."
          path="/checkout"
          robots="noindex, nofollow"
        />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="checkout-panel flex w-full max-w-md flex-col items-center rounded-[2rem] p-10 text-center"
        >
          <Loader2 className="mb-5 h-12 w-12 animate-spin text-[#4A3362]" />
          <h1 className="font-serif text-3xl font-black text-[#4A3362]">
            Carrito cargando...
          </h1>
          <p className="mt-3 text-sm font-black text-[#4A3362]">
            Estamos preparando tu pedido para continuar con el pago.
          </p>
        </motion.div>
      </div>
    );
  }

  if (orderStatus === "success") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <Seo
          title="Checkout | DIFIORI"
          description="Proceso de checkout de DIFIORI."
          path="/checkout"
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
          <h2 className="text-3xl font-serif font-black text-[#4A3362] mb-3">
            ¡Orden confirmada!
          </h2>
          <p className="text-[#4A3362] font-black text-lg mb-2">
            {orderNumber}
          </p>
          <p className="text-[#4A3362] text-base font-black mb-8">
            Hemos recibido tu pedido. El vendedor se pondrá en contacto contigo.
            Esperamos tu respuesta.
          </p>
          <Link href="/">
            <button className="w-full bg-[#4B1F6F] hover:bg-[#4A3362] text-white py-5 rounded-3xl font-black text-base transition-all shadow-xl">
              Volver a la tienda
            </button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="checkout-shell min-h-screen bg-white px-3 pb-20 pt-8 sm:px-6 sm:pt-16">
      <Seo
        title="Checkout | DIFIORI"
        description="Proceso de checkout de DIFIORI."
        path="/checkout"
        robots="noindex, nofollow"
      />
      <CartDialog />
      <div className="container relative mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col items-center text-center sm:mb-10">
          <Link
            href="/#catalogo"
            className="group mb-5 inline-flex items-center gap-2 font-black text-[#4A3362] transition-colors hover:text-[#4A3362]"
          >
            <ChevronLeft className="h-5 w-5 transition-transform group-hover:translate-x-[-5px]" />
            Seguir comprando
          </Link>

          <h1 className="text-3xl font-serif font-black text-[#4A3362] sm:text-5xl">
            Finaliza tu pedido
          </h1>
        </div>

        <p className="mx-auto mb-5 max-w-2xl rounded-2xl border border-[#E5D7EF] bg-white px-4 py-3 text-center text-sm font-black text-[#4A3362] shadow-[0_12px_32px_rgba(74,51,98,0.06)] sm:text-base">
          Todo está en una sola página: tus datos, entrega, pago y resumen. Completa de arriba hacia abajo y confirma al final.
        </p>
        <div className="mx-auto mb-5 flex max-w-2xl flex-col items-center justify-between gap-3 rounded-2xl border border-[#25D366]/25 bg-[#F2FFF7] px-4 py-4 text-center shadow-[0_12px_32px_rgba(37,211,102,0.10)] sm:flex-row sm:text-left">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.12em] text-[#168A43]">
              ¿Necesitas ayuda?
            </p>
            <p className="mt-1 text-sm font-bold text-[#255E3A]">
              Te guiamos por WhatsApp para llenar datos, entrega o pago.
            </p>
          </div>
          <a
            href={checkoutWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#25D366]/20 transition hover:bg-[#1ebe5d]"
          >
            <MessageSquare className="h-4 w-4" />
            Ayuda por WhatsApp
          </a>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-1.5 rounded-[1.25rem] border border-[#E5D7EF] bg-white p-1.5 shadow-[0_12px_32px_rgba(74,51,98,0.08)] sm:mb-8 sm:gap-2 sm:rounded-[1.5rem] sm:p-2">
          {CHECKOUT_STEPS.map((step, index) => {
            const isActive = step.id === activeStep;
            const isComplete = index < activeStepIndex;
            const StepIcon = step.Icon;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepChange(step.id)}
                className={cn(
                  "flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[1rem] px-1.5 text-center transition-all sm:min-h-[78px] sm:flex-row sm:gap-3 sm:px-2 sm:text-left",
                  isActive
                    ? "bg-[#4B1F6F] text-white shadow-lg shadow-[#4B1F6F]/20"
                    : "bg-white text-[#4A3362] hover:bg-[#FBF7FD]"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black sm:h-10 sm:w-10 sm:text-base",
                    isActive
                      ? "border-white/40 bg-white/15 text-white"
                      : isComplete
                        ? "border-[#4B1F6F] bg-[#4B1F6F] text-white"
                        : "border-[#DCC5E8] bg-[#FBF7FD] text-[#4A3362]"
                  )}
                >
                  {isComplete ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </span>
                  <span className="min-w-0">
                    <span className="block text-[0.72rem] font-black leading-tight sm:text-lg">
                      {step.label}
                    </span>
                  <span
                    className={cn(
                      "hidden text-sm font-bold sm:block",
                      isActive ? "text-white/75" : "text-[#4A3362]"
                    )}
                  >
                    {step.helper}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start xl:grid-cols-[minmax(0,1fr)_490px]">
          <aside className="order-2 checkout-panel rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-7 lg:sticky lg:top-8 lg:order-2">
            <div className="space-y-5 sm:space-y-6">
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex min-w-0 items-center gap-2 text-2xl font-black tracking-tight text-[#4B1F6F] sm:gap-3 sm:text-4xl xl:text-5xl" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                    <ShoppingBag className="h-7 w-7 shrink-0 text-[#4B1F6F] sm:h-8 sm:w-8 xl:h-9 xl:w-9" /> <span className="min-w-0 break-words">Resumen</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleOpenCart}
                    disabled={isCartOpening || isCheckoutBusy}
                    className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-gradient-to-r from-[#5A2A82] via-[#7B3FB0] to-[#C6539B] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.08em] text-white shadow-[0_12px_28px_rgba(123,63,176,0.35)] ring-2 ring-[#C6539B]/15 transition-all hover:from-[#6B32A0] hover:via-[#8E49C8] hover:to-[#D65CAB] hover:shadow-[0_16px_34px_rgba(123,63,176,0.45)] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-2.5 sm:text-xs xl:px-5 xl:text-sm xl:tracking-widest"
                  >
                    {isCartOpening ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                    {isCartOpening ? "Abriendo..." : "Ver / cambiar"}
                  </button>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {items.length === 0 ? (
                    <p className="rounded-2xl border border-[#E5D7EF] bg-[#FBF7FD] px-5 py-4 text-base font-black text-[#4A3362]">
                      Tu carrito esta vacio.
                    </p>
                  ) : (
                    items.map((item, i) => (
                      <div
                        key={i}
                        className="flex min-w-full items-center gap-3 rounded-2xl border border-[#E5D7EF] bg-[#FBF7FD] p-3 sm:gap-5 sm:p-4"
                      >
                        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-[#DCC5E8] bg-white sm:h-28 sm:w-24">
                          <img
                            src={item.product.image}
                            className="h-full w-full object-contain p-1"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="whitespace-normal break-words text-base font-black leading-tight text-[#4B1F6F] sm:text-[1.55rem]" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                            {item.product.name}
                          </h4>
                          <p className="mt-1 text-lg font-black text-[#4B1F6F] sm:mt-1.5 sm:text-[1.7rem]" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                            {item.product.price}
                          </p>
                          <p className="mt-1 text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#4B1F6F] sm:mt-1.5 sm:text-[1.32rem] sm:tracking-[0.16em]" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                            Cant: {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5D7EF] bg-[#FBF7FD] p-4 sm:p-5">
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-[#4A3362]">
                    Cupón
                  </label>
                  <div className="flex flex-col gap-2 min-[380px]:flex-row">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="CODIGO"
                      disabled={!!appliedCoupon}
                      className="checkout-input min-w-0 flex-1 px-4 py-3 text-base font-bold uppercase"
                    />
                    {appliedCoupon ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponCode("");
                        }}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-500"
                      >
                        Quitar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleValidateCoupon}
                        disabled={isValidatingCoupon || !couponCode}
                        className="rounded-xl bg-[#4B1F6F] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#4B1F6F]/20 disabled:opacity-50"
                      >
                        {isValidatingCoupon ? "..." : "Aplicar"}
                      </button>
                    )}
                  </div>
                  {appliedCoupon && (
                    <p className="mt-2 text-[10px] font-bold uppercase text-green-600">
                      Cupón aplicado
                    </p>
                  )}
                </div>

                <div className="space-y-3.5 border-t border-[#DCC5E8] pt-5">
                  <div className="flex items-start justify-between gap-3 text-base font-black text-[#4B1F6F] sm:text-[1.42rem]" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                    <span>Subtotal</span>
                    <span>${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-base font-black text-[#4B1F6F] sm:text-[1.42rem]" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                    <span>Sector</span>
                    <span className="min-w-0 max-w-[58%] break-words text-right text-[#4B1F6F]">
                      {sectorInput || "Pendiente"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-base font-black text-[#4B1F6F] sm:text-[1.42rem]" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                    <span>Envío</span>
                    <span className="min-w-0 max-w-[58%] break-words text-right text-[#4B1F6F]">
                      {shippingResolution.isMatched
                        ? `+$${shippingCost.toFixed(2)}`
                        : sectorInput
                          ? "A coordinar"
                          : "Ingresa tu sector"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-base font-black text-[#4B1F6F] sm:text-[1.42rem]" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                    <span>Pago</span>
                    <span className="text-[#4B1F6F]">{paymentMethod || "Pendiente"}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[1rem] font-bold text-green-600">
                      <span>Descuento</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-3 border-t border-[#DCC5E8] pt-4 text-3xl font-black text-[#4B1F6F] sm:text-[2.65rem]" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                    <span className="font-serif">Total</span>
                    <span className="min-w-0 break-words text-right text-[#4B1F6F]">
                      ${finalTotal.toFixed(2)}
                    </span>
                  </div>
                  {shippingResolution.isMatched && (
                    <p className="text-right text-[0.82rem] font-black text-[#4A3362]">
                      Total con envío adicional de ${shippingCost.toFixed(2)} para {shippingResolution.matchedSector}.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={!canConfirmOrder || isCheckoutBusy}
                  className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#4B1F6F] px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-[#4B1F6F]/20 transition-all hover:bg-[#4A3362] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-5 sm:text-base sm:tracking-widest"
                >
                  {isCheckoutBusy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {orderStatus === "loading" ? "Procesando..." : "Cargando..."}
                    </>
                  ) : (
                    `Confirmar pedido $${finalTotal.toFixed(2)}`
                  )}
                </button>
              </div>
            </div>
          </aside>

          <div className="order-1 space-y-8 lg:order-1">
            <AnimatePresence>
              {errorMsg && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm font-bold text-red-500"
                >
                  {errorMsg}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="space-y-5 sm:space-y-8">
              <div
                id="checkout-sender"
                onChange={updateCheckoutProgress}
                className="checkout-panel scroll-mt-8 space-y-5 rounded-[1.5rem] p-4 sm:space-y-7 sm:rounded-[2rem] sm:p-10"
              >
                <h3 className="flex items-center gap-2 font-sans text-2xl font-black tracking-tight text-[#4B0082] sm:gap-3 sm:text-4xl">
                  <User className="h-7 w-7 sm:h-9 sm:w-9" /> Quién envía
                </h3>
                <p className="rounded-2xl bg-[#FBF7FD] p-4 text-sm font-bold text-[#4A3362]">
                  Estos datos son para confirmar el pedido contigo. El correo debe ser válido y los campos con * son obligatorios.
                </p>
                <div className="grid grid-cols-1 gap-5">
                  <label className="checkout-field">
                    <span>
                      <User className="h-5 w-5" /> Nombre *
                    </span>
                    <input
                      ref={senderNameRef}
                      autoComplete="name"
                      className="checkout-input"
                      placeholder="Nombre completo"
                    />
                  </label>
                  <label className="checkout-field">
                    <span>
                      <Mail className="h-5 w-5" /> Correo electrónico *
                    </span>
                    <input
                      ref={senderEmailRef}
                      type="email"
                      autoComplete="email"
                      className="checkout-input"
                      placeholder="correo@ejemplo.com"
                    />
                  </label>
                  <label className="checkout-field">
                    <span>
                      <Phone className="h-5 w-5" /> Teléfono *
                    </span>
                    <input
                      ref={senderPhoneRef}
                      type="tel"
                      autoComplete="tel"
                      className="checkout-input"
                      placeholder="Numero para confirmar el pedido"
                    />
                  </label>
                </div>
              </div>

              <div
                id="checkout-receiver"
                onChange={updateCheckoutProgress}
                className="checkout-panel scroll-mt-8 space-y-5 rounded-[1.5rem] p-4 sm:space-y-7 sm:rounded-[2rem] sm:p-10"
              >
                <h3 className="flex items-center gap-2 font-sans text-2xl font-black tracking-tight text-[#4B0082] sm:gap-3 sm:text-4xl">
                  <Truck className="h-7 w-7 sm:h-9 sm:w-9" /> Quién recibe
                </h3>
                <p className="rounded-2xl bg-[#FBF7FD] p-4 text-sm font-bold text-[#4A3362]">
                  Selecciona el sector para calcular el envío. Sin destino de entrega no se habilitan los métodos de pago.
                </p>
                <div className="grid grid-cols-1 gap-5">
                  <label className="checkout-field">
                    <span>
                      <User className="h-5 w-5" /> Nombre de la persona *
                    </span>
                    <input
                      ref={receiverNameRef}
                      className="checkout-input"
                      placeholder="Nombre de quien recibe"
                    />
                  </label>
                  <label className="checkout-field">
                    <span>
                      <Phone className="h-5 w-5" /> Teléfono *
                    </span>
                    <input
                      ref={receiverPhoneRef}
                      type="tel"
                      className="checkout-input"
                      placeholder="Telefono de quien recibe"
                    />
                  </label>
                  <label className="checkout-field">
                    <span>
                      <MapPin className="h-5 w-5" /> {hasConfiguredShippingSectors ? "Sector *" : "Sector o zona"}
                    </span>
                    {hasConfiguredShippingSectors ? (
                      <select
                        ref={sectorSelectRef}
                        value={sectorInput}
                        onChange={(e) => {
                          setSectorInput(e.target.value);
                          updateCheckoutProgress();
                        }}
                        className="checkout-input"
                      >
                        <option value="" disabled>
                          Selecciona un sector
                        </option>
                        {shippingSectorRates.map((item) => (
                          <option key={item.sector} value={item.sector}>
                            {item.sector}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        ref={sectorInputRef}
                        value={sectorInput}
                        onChange={(e) => {
                          setSectorInput(e.target.value);
                          updateCheckoutProgress();
                        }}
                        className="checkout-input"
                        placeholder="Ej: Urdesa, Samborondón, vía a la costa"
                      />
                    )}
                    <span className="text-sm font-black text-[#4A3362]">
                      {shippingResolution.isMatched
                        ? `Costo de envío para ${shippingResolution.matchedSector}: $${shippingCost.toFixed(2)}`
                        : shippingSectorRates.length === 0
                          ? "Aún no hay sectores precargados. Escribe tu zona y te contactaremos para confirmar el envío."
                          : "Selecciona tu sector para calcular el envío."}
                    </span>
                  </label>
                  <label className="checkout-field">
                    <span>
                      <Clock className="h-5 w-5" /> Hora de entrega *
                    </span>
                    <input
                      ref={dateTimeRef}
                      className="checkout-input"
                      placeholder="Ej: hoy de 15:00 a 17:00"
                    />
                  </label>
                  <label className="checkout-field">
                    <span>
                      <MapPin className="h-5 w-5" /> Dirección exacta *
                    </span>
                    <input
                      ref={addressRef}
                      className="checkout-input"
                      placeholder="Ciudadela, calle, manzana, villa, referencia"
                    />
                  </label>
                  <label className="checkout-field">
                    <span>
                      <MessageSquare className="h-5 w-5" /> Mensaje para la tarjeta *
                    </span>
                    <textarea
                      ref={cardMessageRef}
                      className="checkout-input h-28 resize-none"
                      placeholder="Escribe el mensaje que irá en la tarjeta"
                    />
                  </label>
                  <label className="checkout-field">
                    <span>
                      <FileText className="h-5 w-5" /> Observaciones
                    </span>
                    <textarea
                      ref={observationsRef}
                      className="checkout-input h-24 resize-none"
                      placeholder="Referencias, indicaciones o detalles especiales"
                    />
                  </label>
                </div>
              </div>

              <div
                id="checkout-payment"
                className="checkout-panel scroll-mt-8 space-y-5 rounded-[1.5rem] p-4 sm:space-y-8 sm:rounded-[2rem] sm:p-10"
              >
                <h3 className="flex items-center gap-2 font-sans text-2xl font-black tracking-tight text-[#4B0082] sm:gap-3 sm:text-4xl">
                  <CreditCard className="h-7 w-7 sm:h-9 sm:w-9" /> Métodos de pago
                </h3>
                {!checkoutReadiness.canChoosePayment ? (
                  <div className="rounded-2xl border border-[#DCC5E8] bg-[#FBF7FD] p-4 text-sm font-black text-[#4A3362] sm:text-base">
                    Completa primero tus datos y la entrega. El pago se habilita cuando selecciones el sector/destino de envío y llenes todos los campos obligatorios.
                  </div>
                ) : null}
                <a
                  href={checkoutWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#25D366]/30 bg-[#F2FFF7] px-4 py-3 text-sm font-black text-[#168A43] transition hover:bg-[#E8FFF1] sm:w-auto"
                >
                  <MessageSquare className="h-4 w-4" />
                  Tengo dudas sobre el pago
                </a>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {PAYMENT_METHODS.map(({ label, description, Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (!checkoutReadiness.canChoosePayment) return;
                        setPaymentMethod(label);
                      }}
                      disabled={isCheckoutBusy || !checkoutReadiness.canChoosePayment}
                      className={cn(
                        "flex min-h-[132px] flex-col items-start justify-between rounded-2xl border p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
                        paymentMethod === label
                          ? "border-[#4B1F6F] bg-[#4B1F6F] text-white shadow-lg shadow-[#4B1F6F]/20"
                          : "border-[#DCC5E8] bg-white text-[#4A3362] hover:border-[#B58CCC] hover:bg-[#FBF7FD]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-7 w-7",
                          paymentMethod === label
                            ? "text-white"
                            : "text-[#4A3362]"
                        )}
                      />
                      <span className="text-2xl font-black">{label}</span>
                      <span
                        className={cn(
                          "text-base font-black leading-snug",
                          paymentMethod === label
                            ? "text-white/80"
                            : "text-[#4A3362]"
                        )}
                      >
                        {description}
                      </span>
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={paymentMethod || "payment-locked"}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="checkout-subpanel rounded-2xl border border-dashed border-[#B58CCC] p-6"
                  >
                    {!paymentMethod && (
                      <p className="text-base font-black text-[#4A3362]">
                        Cuando completes los datos obligatorios podrás elegir Banco, Zelle, Payphone o PayPal.
                      </p>
                    )}
                    {paymentMethod === "Banco" && (
                      <>
                        <p className="mb-4 text-base font-black text-[#4A3362]">
                          Datos para transferencia bancaria:
                        </p>
                        <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-[#4A3362]">
                          {transferInstructions}
                        </pre>
                        <p className="mt-4 text-base font-black text-[#4A3362]">
                          Puedes adjuntar el comprobante aquí. Cuando confirmes el pedido se subirá automáticamente y el admin lo verá en la orden.
                        </p>
                      </>
                    )}
                    {paymentMethod === "Payphone" && (
                      <div className="flex items-start gap-4">
                        <Smartphone className="mt-1 h-7 w-7 text-[#4A3362]" />
                        <div>
                          <p className="text-lg font-black text-[#4A3362]">
                            Pago seguro con Payphone
                          </p>
                          <p className="mt-1 text-base font-black text-[#4A3362]">
                            Al confirmar serás redirigido a la pasarela para ingresar los datos de tu tarjeta.
                          </p>
                        </div>
                      </div>
                    )}
                    {paymentMethod === "PayPal" && (
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <Globe2 className="mt-1 h-7 w-7 text-[#4A3362]" />
                          <div>
                            <p className="text-lg font-black text-[#4A3362]">
                              Pago internacional o con tarjeta de crédito
                            </p>
                            <p className="mt-1 text-base font-black text-[#4A3362]">
                              Al confirmar te redirigiremos a PayPal para completar el pago de forma segura.
                            </p>
                          </div>
                        </div>
                        <label className="block text-sm font-black text-[#4A3362]">
                          Correo PayPal *
                          <input
                            type="email"
                            required
                            value={paypalPayerEmail}
                            onChange={(e) => setPaypalPayerEmail(e.target.value)}
                            placeholder="correo@ejemplo.com"
                            className={cn(
                              "mt-3 w-full rounded-3xl border bg-[#FAF7FC] px-4 py-3 text-[#4A3362] outline-none transition focus:ring-2",
                              paypalPayerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalPayerEmail)
                                ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                : "border-[#DCC5E8] focus:border-[#4B1F6F] focus:ring-[#4B1F6F]/20"
                            )}
                          />
                          {paypalPayerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalPayerEmail) && (
                            <p className="mt-1 text-xs text-red-600">
                              Formato de correo inválido
                            </p>
                          )}
                          <p className="mt-2 text-sm font-normal text-[#4A3362]">
                            Ingresa el correo de la cuenta PayPal que usaras para pagar.
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#4A3362]">
                            Debe coincidir con el correo de la cuenta PayPal que completara el pago.
                          </p>
                        </label>
                      </div>
                    )}
                    {paymentMethod === "Zelle" && (
                      <div className="flex items-start gap-4">
                        <CreditCard className="mt-1 h-7 w-7 text-[#4A3362]" />
                        <div>
                          <p className="text-lg font-black text-[#4A3362]">
                            Pago por Zelle
                          </p>
                          <pre className="mt-2 whitespace-pre-wrap font-sans text-base leading-relaxed text-[#4A3362]">
                            {DEFAULT_ZELLE_INSTRUCTIONS}
                          </pre>
                          <p className="mt-3 text-base font-black text-[#4A3362]">
                            Si ya hiciste el pago, adjunta aquí tu comprobante para subirlo automáticamente al confirmar el pedido.
                          </p>
                        </div>
                      </div>
                    )}
                    {(paymentMethod === "Banco" ||
                      paymentMethod === "Zelle" ||
                      paymentMethod === "PayPal") && (
                      <div className="mt-6 rounded-2xl border border-[#DCC5E8] bg-white p-4">
                        <p className="text-base font-black text-[#4A3362]">
                          Comprobante de pago
                        </p>
                        <p className="mt-1 text-sm font-black text-[#4A3362]">
                          Selecciona la imagen del comprobante. Al confirmar el pedido se guardará automáticamente para que el admin pueda verlo.
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            setSelectedProofFile(e.target.files?.[0] || null);
                            setProofMessage("");
                          }}
                          className="mt-4 block w-full text-sm text-[#4A3362] file:mr-3 file:rounded-xl file:border-0 file:bg-[#4B1F6F] file:px-4 file:py-2 file:text-white"
                        />
                        <p className="mt-3 text-sm font-black text-[#4A3362]">
                          {selectedProofFile
                            ? `Archivo listo: ${selectedProofFile.name}`
                            : "Aún no has seleccionado un comprobante."}
                        </p>
                        {proofMessage && (
                          <p className="mt-2 text-sm text-[#4A3362]">
                            {proofMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleConfirmOrder}
                    disabled={!canConfirmOrder || isCheckoutBusy}
                    className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-[#4B1F6F] px-4 py-4 text-base font-black text-white shadow-lg shadow-[#4B1F6F]/20 transition-all hover:bg-[#4A3362] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-5 sm:text-lg"
                  >
                    {orderStatus === "loading" ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      `Confirmar pedido $${finalTotal.toFixed(2)}`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}
