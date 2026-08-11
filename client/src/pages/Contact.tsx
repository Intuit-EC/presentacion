import { useState } from "react";
import { Link } from "wouter";
import { Clock3, Mail, MapPin, MessageSquare, Phone, ShieldCheck } from "lucide-react";
import { Seo } from "@/components/Seo";
import { DEFAULT_COMPANY } from "@/lib/site";
import { useCompany } from "@/hooks/useCompany";

const CONTACT_CHANNELS = [
  {
    title: "WhatsApp",
    copy: "La vía más rápida. Te confirmamos disponibilidad y horario de entrega.",
    Icon: MessageSquare,
  },
  {
    title: "Correo",
    copy: "Para pedidos corporativos, facturación o convenios.",
    Icon: Mail,
  },
  {
    title: "Cobertura",
    copy: "Entregas a domicilio en Guayaquil y alrededores, todos los días.",
    Icon: MapPin,
  },
];

export default function Contact() {
  const { data: company } = useCompany();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const phoneDisplay = company?.phone || DEFAULT_COMPANY.phoneDisplay;
  const phoneDigits = phoneDisplay.replace(/[^0-9]/g, "") || DEFAULT_COMPANY.phoneDigits;
  const email = company?.email || DEFAULT_COMPANY.email;

  // El formulario anterior simulaba el envío con un temporizador y decía
  // "Mensaje enviado" sin mandar nada a ninguna parte: cada consulta se perdía.
  // Ahora abre WhatsApp, que es el canal por el que realmente se atiende.
  const whatsappHref = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(
    `Hola DIFIORI, soy ${name || "un cliente"}. ${message || "Quisiera hacer una consulta sobre un pedido."}`,
  )}`;

  return (
    <div className="page-shell">
      <Seo
        title="Contacto | Floreria DIFIORI en Guayaquil"
        description="Escríbenos por WhatsApp o correo para pedidos de flores, arreglos y regalos a domicilio en Guayaquil. Atención todos los días."
        path="/contacto"
      />

      <div className="page-container">
        <header className="page-header">
          <p className="page-kicker">Hablemos</p>
          <h1 className="page-title">Contacto</h1>
          <p className="page-copy">
            Coordinamos entregas en Guayaquil todos los días. Cuéntanos qué necesitas y te
            confirmamos disponibilidad, sector y horario en minutos.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="surface-card p-7">
              <h2 className="font-serif text-2xl italic text-foreground">Datos directos</h2>
              <dl className="mt-6 space-y-5 text-base">
                <div className="flex items-start gap-3">
                  <Phone className="mt-1 h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/55">
                      Teléfono y WhatsApp
                    </dt>
                    <dd className="font-bold text-foreground">{phoneDisplay}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/55">
                      Correo
                    </dt>
                    <dd className="font-bold break-words text-foreground">{email}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/55">
                      Zona de entrega
                    </dt>
                    <dd className="font-bold text-foreground">
                      {DEFAULT_COMPANY.city}, {DEFAULT_COMPANY.country}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-1 h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/55">
                      Atención
                    </dt>
                    <dd className="font-bold text-foreground">Todos los días, coordinamos por WhatsApp</dd>
                  </div>
                </div>
              </dl>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {CONTACT_CHANNELS.map(({ title, copy, Icon }) => (
                <div key={title} className="surface-card p-5">
                  <Icon className="mb-3 h-5 w-5 text-accent" />
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/70">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card h-fit p-7">
            <h2 className="font-serif text-2xl italic text-foreground">Escríbenos</h2>
            <p className="mt-2 text-sm text-foreground/70">
              Completa los datos y se abrirá WhatsApp con tu mensaje listo para enviar.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-foreground/55">
                  Tu nombre
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej: María Pérez"
                  className="w-full rounded-2xl border border-primary/25 bg-white px-4 py-3 font-semibold text-foreground outline-none transition focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-foreground/55">
                  ¿Qué necesitas?
                </span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Ej: un ramo de rosas para entregar mañana en Urdesa"
                  className="h-36 w-full resize-none rounded-2xl border border-primary/25 bg-white px-4 py-3 font-medium text-foreground outline-none transition focus:border-accent"
                />
              </label>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-btn-primary w-full"
              >
                <MessageSquare className="h-4 w-4" />
                Enviar por WhatsApp
              </a>

              <a href={`mailto:${email}`} className="ui-btn-secondary w-full">
                <Mail className="h-4 w-4" />
                Escribir por correo
              </a>

              <p className="flex items-center justify-center gap-2 pt-1 text-center text-xs font-bold text-foreground/60">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Respondemos el mismo día durante el horario de atención.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/shop" className="ui-btn-secondary">
            Ver el catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
