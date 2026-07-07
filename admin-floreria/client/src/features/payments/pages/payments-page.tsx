import { useEffect, useState, type InputHTMLAttributes } from "react";
import { toast } from "sonner";
import ecommerceService from "@/core/api/ecommerce-service";
import { Button } from "@/shared/components/ui/button";

type ShippingSectorRate = {
  sector: string;
  cost: string;
};

type PaymentSettings = {
  acceptOrders: boolean;
  paypalEnvironment: "sandbox" | "live";
  paypalSandboxClientId: string;
  paypalSandboxClientSecret: string;
  paypalSandboxMerchantId: string;
  paypalSandboxWebhookId: string;
  paypalLiveClientId: string;
  paypalLiveClientSecret: string;
  paypalLiveMerchantId: string;
  paypalLiveWebhookId: string;
  payphoneEnvironment: "sandbox" | "live";
  payphoneSandboxStoreId: string;
  payphoneSandboxToken: string;
  payphoneSandboxWebhookToken: string;
  payphoneLiveStoreId: string;
  payphoneLiveToken: string;
  payphoneLiveWebhookToken: string;
  transferInstructions: string;
  shippingSectorRates: ShippingSectorRate[];
  ownerNotificationEmail: string;
  ownerNotificationName: string;
};

const DEFAULT_TRANSFER_INSTRUCTIONS = `Banco Pichincha cta ahorro # 2202306049
Banco Pacifico cta ahorro # 0851179635
Banco Guayaquil cta ahorro # 1389429

Nombre: Maritza Iveth Medranda Flor
CI: 0910784024
Correo: ventas@difiori.com.ec`;

const DEFAULT_SETTINGS: PaymentSettings = {
  acceptOrders: true,
  paypalEnvironment: "sandbox",
  paypalSandboxClientId: "",
  paypalSandboxClientSecret: "",
  paypalSandboxMerchantId: "",
  paypalSandboxWebhookId: "",
  paypalLiveClientId: "",
  paypalLiveClientSecret: "",
  paypalLiveMerchantId: "",
  paypalLiveWebhookId: "",
  payphoneEnvironment: "sandbox",
  payphoneSandboxStoreId: "",
  payphoneSandboxToken: "",
  payphoneSandboxWebhookToken: "",
  payphoneLiveStoreId: "",
  payphoneLiveToken: "",
  payphoneLiveWebhookToken: "",
  transferInstructions: DEFAULT_TRANSFER_INSTRUCTIONS,
  shippingSectorRates: [],
  ownerNotificationEmail: "",
  ownerNotificationName: "",
};

function normalizeSectorRates(value: unknown): ShippingSectorRate[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const source = item && typeof item === "object" ? item : {};
    const sector = typeof (source as { sector?: unknown }).sector === "string"
      ? String((source as { sector?: unknown }).sector)
      : "";
    const cost = (source as { cost?: unknown }).cost;

    return {
      sector,
      cost:
        typeof cost === "number"
          ? String(cost)
          : typeof cost === "string"
            ? cost
            : "",
    };
  });
}

function ensureEditableSectorRates(value: ShippingSectorRate[]): ShippingSectorRate[] {
  return value;
}

function normalizeEditableCost(value: string) {
  return value.replace(/[^\d,.\s$]/g, "");
}

export default function PaymentsPage() {
  const [form, setForm] = useState<PaymentSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingPaypal, setIsTestingPaypal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await ecommerceService.get("/admin/company/payment-settings");
        const settings = response.data?.data?.settings || {};
        const paymentSettings = settings.paymentSettings || {};
        setForm({
          ...DEFAULT_SETTINGS,
          ...paymentSettings,
          acceptOrders: settings.acceptOrders ?? true,
          shippingSectorRates: ensureEditableSectorRates(
            normalizeSectorRates(paymentSettings.shippingSectorRates)
          ),
        });
      } catch (error) {
        console.error("Load payment settings error:", error);
        toast.error("No se pudo cargar la configuracion de pagos");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const updateField = <K extends keyof PaymentSettings>(
    field: K,
    value: PaymentSettings[K]
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateSectorRate = (
    index: number,
    field: keyof ShippingSectorRate,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      shippingSectorRates: current.shippingSectorRates.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addSectorRate = () => {
    setForm((current) => ({
      ...current,
      shippingSectorRates: [
        { sector: "", cost: "" },
        ...current.shippingSectorRates,
      ],
    }));
  };

  const moveSectorRate = (fromIndex: number, toIndex: number) => {
    setForm((current) => {
      if (toIndex < 0 || toIndex >= current.shippingSectorRates.length) return current;
      const shippingSectorRates = [...current.shippingSectorRates];
      const [moved] = shippingSectorRates.splice(fromIndex, 1);
      shippingSectorRates.splice(toIndex, 0, moved);
      return { ...current, shippingSectorRates };
    });
  };

  const removeSectorRate = (index: number) => {
    setForm((current) => ({
      ...current,
      shippingSectorRates: ensureEditableSectorRates(
        current.shippingSectorRates.filter((_, itemIndex) => itemIndex !== index)
      ),
    }));
  };

  const buildPaymentSettingsPayload = (settings = form) => {
    const normalizedSectorRates = settings.shippingSectorRates.map((item) => ({
      sector: item.sector.trim(),
      cost: item.cost.trim(),
    }));

    return {
      normalizedSectorRates,
      payload: {
        ...settings,
        shippingSectorRates: normalizedSectorRates.filter(
          (item) => item.sector && item.cost
        ),
      },
    };
  };

  const handleSave = async () => {
    const { normalizedSectorRates, payload } = buildPaymentSettingsPayload();
    const hasIncompleteSectorRate = normalizedSectorRates.some(
      (item) => (item.sector && !item.cost) || (!item.sector && item.cost)
    );

    if (hasIncompleteSectorRate) {
      toast.error("Cada sector debe tener nombre y costo para poder guardarse.");
      return false;
    }

    try {
      setIsSaving(true);
      const response = await ecommerceService.put("/admin/company/payment-settings", payload);
      const savedPaymentSettings = response.data?.data?.settings?.paymentSettings || {};
      const savedSettings = response.data?.data?.settings || {};
      setForm({
        ...DEFAULT_SETTINGS,
        ...savedPaymentSettings,
        acceptOrders: savedSettings.acceptOrders ?? true,
        shippingSectorRates: ensureEditableSectorRates(
          normalizeSectorRates(savedPaymentSettings.shippingSectorRates)
        ),
      });
      toast.success("Configuracion de pagos guardada");
      return true;
    } catch (error) {
      console.error("Save payment settings error:", error);
      toast.error("No se pudo guardar la configuracion");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAcceptOrders = async () => {
    const nextForm = {
      ...form,
      acceptOrders: !form.acceptOrders,
    };
    const { normalizedSectorRates, payload } = buildPaymentSettingsPayload(nextForm);
    const hasIncompleteSectorRate = normalizedSectorRates.some(
      (item) => (item.sector && !item.cost) || (!item.sector && item.cost)
    );

    if (hasIncompleteSectorRate) {
      toast.error("Completa o elimina los sectores incompletos antes de cambiar el estado.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await ecommerceService.put("/admin/company/payment-settings", payload);
      const savedSettings = response.data?.data?.settings || {};
      const savedPaymentSettings = savedSettings.paymentSettings || {};
      setForm({
        ...DEFAULT_SETTINGS,
        ...savedPaymentSettings,
        acceptOrders: savedSettings.acceptOrders ?? true,
        shippingSectorRates: ensureEditableSectorRates(
          normalizeSectorRates(savedPaymentSettings.shippingSectorRates)
        ),
      });
      toast.success(nextForm.acceptOrders ? "Pedidos abiertos" : "Pedidos cerrados temporalmente");
    } catch (error) {
      console.error("Toggle orders status error:", error);
      toast.error("No se pudo cambiar el estado de pedidos");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPaypal = async () => {
    try {
      setIsTestingPaypal(true);
      const saved = await handleSave();
      if (!saved) return;

      const response = await ecommerceService.post("/admin/company/payment-settings/test-paypal");
      toast.success(response.data?.message || "Credenciales PayPal válidas");
    } catch (error: any) {
      console.error("Test PayPal settings error:", error);
      toast.error(error?.response?.data?.message || "No se pudieron validar las credenciales de PayPal");
    } finally {
      setIsTestingPaypal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-sm text-gray-500">Cargando configuracion de pagos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Configuracion de Pagos</h1>
        <p className="mt-1 text-gray-600">
          Deja listo el admin para desarrollo y produccion: PayPal, transferencias, envios por sector y correo del dueno.
        </p>
      </header>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Estado de pedidos</h2>
            <p className="mt-1 text-sm text-gray-500">
              Al cerrar pedidos, la web muestra "Tienda cerrada temporalmente" y bloquea nuevas compras.
            </p>
            <p className="mt-2 text-sm font-semibold">
              Estado actual:{" "}
              <span className={form.acceptOrders ? "text-emerald-600" : "text-red-600"}>
                {form.acceptOrders ? "Abierto" : "Cerrado temporalmente"}
              </span>
            </p>
          </div>
          <Button
            type="button"
            onClick={handleToggleAcceptOrders}
            disabled={isSaving || isTestingPaypal}
            className={
              form.acceptOrders
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            {isSaving
              ? "Guardando..."
              : form.acceptOrders
                ? "Cerrar pedidos"
                : "Abrir pedidos"}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Envio por sector</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define los sectores y el costo de envio que vera el cliente en checkout segun lo que escriba.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Las zonas aparecen en el checkout en este mismo orden. Las nuevas se agregan arriba; puedes moverlas antes de guardar.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            onClick={addSectorRate}
          >
            Agregar sector
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isSaving ? "Guardando sectores..." : "Guardar sectores"}
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {form.shippingSectorRates.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              Todavía no hay zonas configuradas. Agrega la primera para definir su nombre, costo y posición.
            </div>
          ) : null}
          {form.shippingSectorRates.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border bg-gray-50 p-3 md:grid-cols-[52px_1fr_180px_auto]">
              <div className="flex items-center gap-1 md:flex-col md:justify-end">
                <span className="mb-1 text-xs font-semibold text-gray-500">#{index + 1}</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Subir ${item.sector || "zona"}`}
                    disabled={index === 0}
                    onClick={() => moveSectorRate(index, index - 1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Bajar ${item.sector || "zona"}`}
                    disabled={index === form.shippingSectorRates.length - 1}
                    onClick={() => moveSectorRate(index, index + 1)}
                  >
                    ↓
                  </Button>
                </div>
              </div>
              <Field
                label="Sector"
                value={item.sector}
                onChange={(value) => updateSectorRate(index, "sector", value)}
                placeholder="Ej: Urdesa, Alborada, Ceibos"
              />
              <Field
                label="Costo"
                value={item.cost}
                onChange={(value) =>
                  updateSectorRate(index, "cost", normalizeEditableCost(value))
                }
                placeholder="Ej: 3.50"
                inputMode="decimal"
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  onClick={() => removeSectorRate(index)}
                >
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">PayPal</h2>
        <p className="mt-1 text-sm text-gray-500">
          Guarda por separado las credenciales de sandbox y live. Al probar, el sistema solicita un token a PayPal con el entorno activo.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-gray-700">Entorno activo de PayPal</span>
            <select
              value={form.paypalEnvironment}
              onChange={(e) =>
                updateField(
                  "paypalEnvironment",
                  e.target.value === "live" ? "live" : "sandbox"
                )
              }
              className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="sandbox">Sandbox</option>
              <option value="live">Live</option>
            </select>
          </label>

          <div className="md:col-span-2 pt-2">
            <h3 className="text-sm font-semibold text-gray-800">Sandbox / Desarrollo</h3>
          </div>
          <Field label="Client ID" value={form.paypalSandboxClientId} onChange={(value) => updateField("paypalSandboxClientId", value)} placeholder="Abc123..." />
          <Field label="Merchant ID" value={form.paypalSandboxMerchantId} onChange={(value) => updateField("paypalSandboxMerchantId", value)} placeholder="XYZMERCHANT..." />
          <Field label="Client Secret" value={form.paypalSandboxClientSecret} onChange={(value) => updateField("paypalSandboxClientSecret", value)} placeholder="Secret..." />
          <Field label="Webhook ID" value={form.paypalSandboxWebhookId} onChange={(value) => updateField("paypalSandboxWebhookId", value)} placeholder="Webhook..." />

          <div className="md:col-span-2 pt-4">
            <h3 className="text-sm font-semibold text-gray-800">Produccion / Live</h3>
          </div>
          <Field label="Client ID" value={form.paypalLiveClientId} onChange={(value) => updateField("paypalLiveClientId", value)} placeholder="Abc123..." />
          <Field label="Merchant ID" value={form.paypalLiveMerchantId} onChange={(value) => updateField("paypalLiveMerchantId", value)} placeholder="XYZMERCHANT..." />
          <Field label="Client Secret" value={form.paypalLiveClientSecret} onChange={(value) => updateField("paypalLiveClientSecret", value)} placeholder="Secret..." />
          <Field label="Webhook ID" value={form.paypalLiveWebhookId} onChange={(value) => updateField("paypalLiveWebhookId", value)} placeholder="Webhook..." />

          <div className="md:col-span-2 flex flex-wrap gap-3 pt-4">
            <Button
              type="button"
              onClick={handleTestPaypal}
              disabled={isSaving || isTestingPaypal}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isTestingPaypal ? "Probando PayPal..." : "Guardar y probar PayPal"}
            </Button>
            <p className="self-center text-xs text-gray-500">
              Se valida el Client ID y Client Secret del entorno activo.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Transferencia / comprobantes</h2>
        <p className="mt-1 text-sm text-gray-500">
          Este texto se muestra al cliente para que pueda transferir y subir su comprobante.
        </p>

        <label className="mt-6 block space-y-2 text-sm">
          <span className="font-medium text-gray-700">Instrucciones</span>
          <textarea
            value={form.transferInstructions}
            onChange={(e) => updateField("transferInstructions", e.target.value)}
            rows={6}
            placeholder={DEFAULT_TRANSFER_INSTRUCTIONS}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
          />
        </label>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Notificaciones internas</h2>
        <p className="mt-1 text-sm text-gray-500">
          El carrito abandonado y otras alertas pueden llegar directo al responsable comercial.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Nombre del responsable" value={form.ownerNotificationName} onChange={(value) => updateField("ownerNotificationName", value)} placeholder="Ventas DIFIORI" />
          <Field label="Email del responsable" value={form.ownerNotificationEmail} onChange={(value) => updateField("ownerNotificationEmail", value)} placeholder="ventas@midominio.com" />
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || isTestingPaypal}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {isSaving ? "Guardando..." : "Guardar configuracion"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
