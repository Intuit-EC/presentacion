import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/Banner";
import { Seo } from "@/components/Seo";
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
      { rootMargin: window.matchMedia("(max-width: 767px)").matches ? "120px 0px" : "600px 0px" },
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
    ],
  };

  return (
    <main className="min-h-screen overflow-clip bg-background scroll-smooth selection:bg-accent selection:text-white">
      <Seo
        title="Flores en Guayaquil | Floreria Guayaquil a Domicilio | DIFIORI"
        description="Flores en Guayaquil y floreria Guayaquil con pedidos a domicilio. Compra ramos, arreglos florales y regalos con entrega en Guayaquil."
        keywords="flores en Guayaquil, floreria Guayaquil, flores a domicilio Guayaquil, pedidos de flores Guayaquil, arreglos florales Guayaquil"
        path="/"
        schema={homeSchema}
      />
      <h1 className="sr-only">DIFIORI Flores en Guayaquil - Floreria Guayaquil con Pedidos de Flores a Domicilio</h1>

      <section className="home-shell-banner-slot">
        <Banner onProductsClick={handleProductsClick} />
      </section>

      <div className="home-shell-main">
        <div
          ref={catalogTriggerRef}
          id="catalogo"
          style={{ minHeight: 1 }}
          aria-hidden="true"
        />
        <Suspense fallback={<CatalogFallback />}>
          {shouldLoadCatalog ? <HomeCatalogSection /> : <CatalogFallback />}
        </Suspense>

        <section className="mx-auto mb-12 mt-12 grid w-full max-w-6xl gap-4 px-6 md:grid-cols-2 xl:grid-cols-4">
          <a href="/flores-guayaquil" className="surface-card p-6 transition-transform hover:-translate-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Flores en Guayaquil</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">
              Flores frescas, ramos y arreglos florales con pedidos a domicilio en Guayaquil.
            </p>
          </a>
          <a href="/arreglos-de-flores-guayaquil" className="surface-card p-6 transition-transform hover:-translate-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Arreglos de flores</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">
              Arreglos de flores en Guayaquil para cumpleaños, amor, condolencias y detalles especiales.
            </p>
          </a>
          <a href="/floreria-guayaquil" className="surface-card p-6 transition-transform hover:-translate-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Floreria Guayaquil</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">
              Floreria DIFIORI para regalos, fechas especiales y entrega a domicilio.
            </p>
          </a>
          <a href="/ramos-de-flores" className="surface-card p-6 transition-transform hover:-translate-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Ramos de flores</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">
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
