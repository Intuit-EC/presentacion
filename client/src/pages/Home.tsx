import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarHeart, Gift, Heart, Sparkles } from "lucide-react";
import { Banner } from "@/components/Banner";
import { Seo } from "@/components/Seo";
import { FAQS } from "@/data/mock";
import { DEFAULT_COMPANY, absoluteUrl, canonicalUrl } from "@/lib/site";
import "./home-shell.css";

const HomeCatalogSection = lazy(() =>
  import("@/components/home/HomeCatalogSection").then((module) => ({ default: module.HomeCatalogSection })),
);

const HomeDeferredSections = lazy(() =>
  import("@/components/home/HomeDeferredSections").then((module) => ({ default: module.HomeDeferredSections })),
);

const DEFERRED_HASH_SECTIONS = ["testimonios", "faq", "contacto"] as const;
const HOME_HASH_SECTIONS = ["catalogo", ...DEFERRED_HASH_SECTIONS] as const;

function CatalogFallback() {
  return (
    <section className="home-shell-catalog-fallback">
      <aside className="home-shell-catalog-fallback-sidebar">
        <div className="surface-card home-shell-catalog-fallback-desktop" />
        <div className="home-shell-catalog-fallback-mobile" />
      </aside>

      <main className="home-shell-catalog-fallback-main">
        <div id="catalogo" className="home-shell-catalog-fallback-head">
          <div className="home-shell-catalog-fallback-line" />
          <h2 className="home-shell-catalog-fallback-title">
            Catalogo de Arreglos Florales
          </h2>
          <div className="home-shell-catalog-fallback-line" />
        </div>

        <div id="product-list" className="home-shell-catalog-fallback-list">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="product-skeleton" />
            ))}
        </div>
      </main>
    </section>
  );
}

function DeferredFallback() {
  return (
    <>
      <section
        id="testimonios"
        className="deferred-section home-shell-deferred-fallback home-shell-deferred-fallback-testimonials"
      >
        <div className="home-shell-deferred-inner home-shell-deferred-inner-wide">
          <div className="home-shell-deferred-heading">
            <div className="home-shell-skeleton home-shell-skeleton-title" />
            <div className="home-shell-skeleton home-shell-skeleton-copy" />
          </div>
          <div className="home-shell-deferred-grid">
            <div className="surface-card home-shell-skeleton-card" />
            <div className="surface-card home-shell-skeleton-card" />
          </div>
        </div>
      </section>

      <section id="faq" className="deferred-section home-shell-deferred-fallback home-shell-deferred-fallback-faq">
        <div className="home-shell-deferred-inner">
          <div className="home-shell-skeleton home-shell-skeleton-title home-shell-skeleton-title-centered" />
          <div className="surface-card home-shell-skeleton-faq" />
          <div className="surface-card home-shell-skeleton-faq" />
        </div>
      </section>

      <section id="contacto" className="deferred-section home-shell-deferred-fallback home-shell-deferred-fallback-footer">
        <div className="home-shell-deferred-inner home-shell-deferred-inner-wide">
          <div className="home-shell-skeleton-footer" />
        </div>
      </section>
    </>
  );
}

export default function Home() {
  const catalogTriggerRef = useRef<HTMLDivElement | null>(null);
  const deferredTriggerRef = useRef<HTMLDivElement | null>(null);
  const hashScrollTimeoutsRef = useRef<number[]>([]);
  const [shouldLoadCatalog, setShouldLoadCatalog] = useState(false);
  const [shouldLoadDeferredSections, setShouldLoadDeferredSections] = useState(false);

  const clearHashScrollTimeouts = () => {
    hashScrollTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    hashScrollTimeoutsRef.current = [];
  };

  const scrollToSection = (id: string, behavior: ScrollBehavior = "smooth") => {
    const target = document.getElementById(id);
    if (!target) return false;

    target.scrollIntoView({ behavior, block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    return true;
  };

  const scrollToSectionWithRetry = (id: string) => {
    clearHashScrollTimeouts();

    const retryDelays = [0, 80, 180, 350, 700, 1100, 1600];
    retryDelays.forEach((delay, index) => {
      const timeoutId = window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          scrollToSection(id, index === 0 ? "smooth" : "auto");
        });
      }, delay);

      hashScrollTimeoutsRef.current.push(timeoutId);
    });
  };

  const handleProductsClick = () => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => scrollToSection("catalogo"), 0);
    });
  };

  useEffect(() => {
    if (shouldLoadCatalog) return;

    const target = catalogTriggerRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      setShouldLoadCatalog(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadCatalog(true);
          observer.disconnect();
        }
      },
      { rootMargin: window.matchMedia("(max-width: 767px)").matches ? "700px 0px" : "900px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoadCatalog]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (hash === "catalogo") {
      setShouldLoadCatalog(true);
      scrollToSectionWithRetry("catalogo");
    }
  }, []);

  useEffect(() => {
    if (shouldLoadDeferredSections) return;

    const target = deferredTriggerRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      setShouldLoadDeferredSections(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadDeferredSections(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoadDeferredSections]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.replace("#", "");
    if (!DEFERRED_HASH_SECTIONS.includes(hash as (typeof DEFERRED_HASH_SECTIONS)[number])) return;

    setShouldLoadDeferredSections(true);
    scrollToSectionWithRetry(hash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (!HOME_HASH_SECTIONS.includes(hash as (typeof HOME_HASH_SECTIONS)[number])) return;

      if (hash === "catalogo") {
        setShouldLoadCatalog(true);
      }

      if (DEFERRED_HASH_SECTIONS.includes(hash as (typeof DEFERRED_HASH_SECTIONS)[number])) {
        setShouldLoadDeferredSections(true);
      }

      scrollToSectionWithRetry(hash);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      clearHashScrollTimeouts();
    };
  }, []);

  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Florist",
        "@id": `${canonicalUrl("/")}#organization`,
        name: "DIFIORI",
        url: canonicalUrl("/"),
        image: absoluteUrl("/opengraph.jpg"),
        telephone: `+${DEFAULT_COMPANY.phoneDigits}`,
        email: DEFAULT_COMPANY.email,
        priceRange: "$$",
        description: "Flores en Guayaquil y floreria Guayaquil con pedidos a domicilio. DIFIORI prepara ramos, arreglos florales y regalos para entrega en Guayaquil.",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Guayaquil",
          addressCountry: "EC",
        },
        areaServed: ["Guayaquil"],
        makesOffer: [
          { "@type": "Offer", itemOffered: { "@type": "Product", name: "Flores en Guayaquil" } },
          { "@type": "Offer", itemOffered: { "@type": "Product", name: "Ramos de flores" } },
          { "@type": "Offer", itemOffered: { "@type": "Product", name: "Arreglos florales a domicilio" } },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${canonicalUrl("/")}#website`,
        name: "DIFIORI",
        url: canonicalUrl("/"),
        inLanguage: "es-EC",
        publisher: {
          "@id": `${canonicalUrl("/")}#organization`,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl("/")}#faq`,
        mainEntity: FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return (
    <main className="min-h-screen overflow-clip bg-background scroll-smooth selection:bg-accent selection:text-white">
      <Seo
        title="Flores y Ramos a Domicilio en Guayaquil | DIFIORI"
        description="Compra flores frescas, ramos y arreglos florales en Guayaquil con entrega a domicilio, pagos seguros y atención rápida por WhatsApp."
        keywords="flores en guayaquil, floreria guayaquil, ramos de flores guayaquil, arreglos florales guayaquil, flores a domicilio guayaquil"
        path="/"
        schema={homeSchema}
      />
      <h1 className="sr-only">DIFIORI Flores en Guayaquil - Floreria Guayaquil con Pedidos de Flores a Domicilio</h1>

      <section className="home-shell-banner-slot">
        <Banner onProductsClick={handleProductsClick} />
      </section>

      <div className="home-shell-main">
        <section className="home-discovery" aria-labelledby="home-discovery-title">
          <div className="home-discovery-heading">
            <span className="home-discovery-kicker">Confianza, estilo y entrega rápida</span>
            <h2 id="home-discovery-title">Elige el detalle perfecto para tu momento</h2>
            <p>Desde un ramo romántico hasta un arreglo elegante para una celebración, te guiamos para comprar con total seguridad y sin complicaciones.</p>
          </div>

          <div className="home-trust-banner" role="note">
            <span className="home-trust-pill">Compra segura</span>
            <p>Confirmamos tu pedido por WhatsApp, entregamos en Guayaquil y cuidamos cada detalle para que tu regalo llegue impecable.</p>
          </div>

          <div className="home-discovery-grid">
            <a href="/flores-guayaquil" className="home-discovery-card">
              <span className="home-discovery-icon"><Heart aria-hidden="true" /></span>
              <span><strong>Celebrar el amor</strong><small>Rosas y detalles románticos</small></span>
              <ArrowRight aria-hidden="true" />
            </a>
            <a href="/ramos-de-flores" className="home-discovery-card">
              <span className="home-discovery-icon"><Gift aria-hidden="true" /></span>
              <span><strong>Sorprender a alguien</strong><small>Regalos que alegran el día</small></span>
              <ArrowRight aria-hidden="true" />
            </a>
            <a href="/arreglos-de-flores-guayaquil" className="home-discovery-card">
              <span className="home-discovery-icon"><CalendarHeart aria-hidden="true" /></span>
              <span><strong>Celebrar una fecha</strong><small>Cumpleaños y momentos únicos</small></span>
              <ArrowRight aria-hidden="true" />
            </a>
            <a href="/#catalogo" className="home-discovery-card home-discovery-card-accent">
              <span className="home-discovery-icon"><Sparkles aria-hidden="true" /></span>
              <span><strong>Explorar todo</strong><small>Déjate inspirar por DIFIORI</small></span>
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>

        <div
          ref={catalogTriggerRef}
          id="catalogo"
          style={{ minHeight: 1 }}
          aria-hidden="true"
        />
        <Suspense fallback={<CatalogFallback />}>
          {shouldLoadCatalog ? <HomeCatalogSection /> : <CatalogFallback />}
        </Suspense>

        <section className="home-guide" aria-label="Explora nuestras colecciones">
          <a href="/flores-guayaquil" className="home-guide-card">
            <h2 className="text-2xl font-semibold text-foreground">Flores en Guayaquil</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              Flores frescas, ramos y arreglos florales con pedidos a domicilio en Guayaquil.
            </p>
          </a>
          <a href="/arreglos-de-flores-guayaquil" className="home-guide-card">
            <h2 className="text-2xl font-semibold text-foreground">Arreglos de flores</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              Arreglos de flores en Guayaquil para cumpleaños, amor, condolencias y detalles especiales.
            </p>
          </a>
          <a href="/floreria-guayaquil" className="home-guide-card">
            <h2 className="text-2xl font-semibold text-foreground">Floreria Guayaquil</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              Floreria DIFIORI para regalos, fechas especiales y entrega a domicilio.
            </p>
          </a>
          <a href="/ramos-de-flores" className="home-guide-card">
            <h2 className="text-2xl font-semibold text-foreground">Ramos de flores</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              Ramos de rosas y flores mixtas para enviar en Guayaquil.
            </p>
          </a>
        </section>

        <div ref={deferredTriggerRef} className="sr-only" aria-hidden="true" />
        <Suspense fallback={<DeferredFallback />}>
          {shouldLoadDeferredSections ? <HomeDeferredSections /> : <DeferredFallback />}
        </Suspense>
      </div>
    </main>
  );
}
