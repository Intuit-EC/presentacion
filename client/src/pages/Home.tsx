import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/Banner";
import { Seo } from "@/components/Seo";
import { DEFAULT_COMPANY, absoluteUrl } from "@/lib/site";
import "./home-shell.css";

const HomeCatalogSection = lazy(() =>
  import("@/components/home/HomeCatalogSection").then((module) => ({ default: module.HomeCatalogSection })),
);

const HomeDeferredSections = lazy(() =>
  import("@/components/home/HomeDeferredSections").then((module) => ({ default: module.HomeDeferredSections })),
);

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
  const [shouldLoadCatalog, setShouldLoadCatalog] = useState(false);
  const [shouldLoadDeferredSections, setShouldLoadDeferredSections] = useState(false);

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  const handleProductsClick = () => {
    setShouldLoadCatalog(true);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => scrollToSection("catalogo"), 0);
    });
  };

  useEffect(() => {
    if (shouldLoadCatalog || typeof window === "undefined") return;
    const timer = window.setTimeout(() => setShouldLoadCatalog(true), 1000);
    return () => window.clearTimeout(timer);
  }, [shouldLoadCatalog]);

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
    if (!["testimonios", "faq", "contacto"].includes(hash)) return;

    setShouldLoadDeferredSections(true);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => scrollToSection(hash), 0);
    });
  }, []);

  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Florist",
        "@id": "https://difiori.com/#organization",
        name: "DIFIORI",
        url: "https://difiori.com/",
        image: absoluteUrl("/opengraph.jpg"),
        telephone: `+${DEFAULT_COMPANY.phoneDigits}`,
        email: DEFAULT_COMPANY.email,
        priceRange: "$$",
        description: "Floreria en Guayaquil especializada en flores, ramos de flores, arreglos florales y regalos a domicilio.",
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
    ],
  };

  return (
    <main className="min-h-screen overflow-clip bg-background scroll-smooth selection:bg-accent selection:text-white">
      <Seo
        title="Floreria Guayaquil | Flores y Ramos de Flores | DIFIORI"
        description="Compra arreglos florales, ramos de flores y regalos a domicilio en Guayaquil con DIFIORI."
        keywords="floreria Guayaquil, flores Guayaquil, florerias en Guayaquil, ramos de flores, arreglos florales Guayaquil"
        path="/"
        schema={homeSchema}
      />
      <h1 className="sr-only">DIFIORI Flores Guayaquil - Floreria en Guayaquil, Ramos de Flores y Arreglos Florales a Domicilio</h1>

      <section className="home-shell-banner-slot">
        <Banner onProductsClick={handleProductsClick} />
      </section>

      <div className="home-shell-main">
        <section className="mx-auto mb-12 grid w-full max-w-6xl gap-4 px-6 md:grid-cols-3">
          <a href="/flores-guayaquil" className="surface-card p-6 transition-transform hover:-translate-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Flores Guayaquil</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">
              Flores frescas y arreglos florales con entrega a domicilio en Guayaquil.
            </p>
          </a>
          <a href="/floreria-guayaquil" className="surface-card p-6 transition-transform hover:-translate-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Floreria Guayaquil</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">
              Floreria DIFIORI para regalos, fechas especiales y pedidos por WhatsApp.
            </p>
          </a>
          <a href="/ramos-de-flores" className="surface-card p-6 transition-transform hover:-translate-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Ramos de flores</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">
              Ramos de rosas y flores mixtas para enviar en Guayaquil.
            </p>
          </a>
        </section>

        <div ref={catalogTriggerRef} className="sr-only" aria-hidden="true" />
        <Suspense fallback={<CatalogFallback />}>
          {shouldLoadCatalog ? <HomeCatalogSection /> : <CatalogFallback />}
        </Suspense>

        <div ref={deferredTriggerRef} className="sr-only" aria-hidden="true" />
        <Suspense fallback={<DeferredFallback />}>
          {shouldLoadDeferredSections ? <HomeDeferredSections /> : <DeferredFallback />}
        </Suspense>
      </div>
    </main>
  );
}
