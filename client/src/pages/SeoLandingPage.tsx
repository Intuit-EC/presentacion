import { Link, useRoute } from "wouter";
import { Flower2, MapPin, MessageSquare, Truck } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { Seo } from "@/components/Seo";
import { useProducts } from "@/hooks/useProducts";
import { DEFAULT_COMPANY, absoluteUrl, canonicalUrl } from "@/lib/site";

const landingPages = {
  "/flores-guayaquil": {
    path: "/flores-guayaquil",
    title: "Flores en Guayaquil | Flores a Domicilio | DIFIORI",
    description:
      "Compra flores en Guayaquil con pedidos a domicilio. DIFIORI entrega ramos de flores, arreglos florales y regalos en Guayaquil.",
    keywords: "flores en Guayaquil, flores a domicilio Guayaquil, arreglos florales Guayaquil, comprar flores Guayaquil, pedidos de flores Guayaquil",
    h1: "Flores en Guayaquil",
    intro:
      "DIFIORI prepara flores frescas, ramos y arreglos florales para entregas a domicilio en Guayaquil. Creamos detalles para cumpleanos, aniversarios, amor, condolencias y regalos especiales.",
    focus: ["Flores frescas seleccionadas", "Entrega a domicilio en Guayaquil", "Pedidos por tienda online o WhatsApp"],
    related: ["/arreglos-de-flores-guayaquil", "/floreria-guayaquil", "/ramos-de-flores"],
  },
  "/floreria-guayaquil": {
    path: "/floreria-guayaquil",
    title: "Floreria Guayaquil | Pedidos a Domicilio | DIFIORI",
    description:
      "Floreria Guayaquil con pedidos a domicilio. En DIFIORI compra flores, ramos, arreglos florales y regalos con entrega en Guayaquil.",
    keywords: "floreria Guayaquil, floreria en Guayaquil, flores en Guayaquil, flores a domicilio Guayaquil, ramos de flores Guayaquil",
    h1: "Floreria Guayaquil",
    intro:
      "DIFIORI es una floreria en Guayaquil con flores frescas, diseno floral, pedidos a domicilio y atencion directa para enviar detalles elegantes en la ciudad.",
    focus: ["Arreglos florales personalizados", "Atencion directa por WhatsApp", "Entrega a domicilio en Guayaquil"],
    related: ["/arreglos-florales-guayaquil", "/arreglos-de-flores-guayaquil", "/flores-guayaquil"],
  },
  "/florerias-en-guayaquil": {
    path: "/florerias-en-guayaquil",
    title: "Florerias en Guayaquil | Floreria DIFIORI con Entrega a Domicilio",
    description:
      "DIFIORI es una floreria en Guayaquil especializada en arreglos florales, ramos de flores y regalos a domicilio para ocasiones especiales.",
    keywords: "florerias en Guayaquil, floreria Guayaquil, floristeria Guayaquil, arreglos florales Guayaquil",
    h1: "Floreria en Guayaquil",
    intro:
      "Si buscas florerias en Guayaquil, DIFIORI combina diseno floral, flores frescas y atencion directa para ayudarte a enviar un detalle elegante el mismo dia o en fecha programada.",
    focus: ["Arreglos florales personalizados", "Atencion directa por WhatsApp", "Entrega a domicilio en Guayaquil"],
    related: ["/floreria-guayaquil", "/arreglos-florales-guayaquil", "/flores-guayaquil"],
  },
  "/ramos-de-flores": {
    path: "/ramos-de-flores",
    title: "Ramos de Flores en Guayaquil | Ramos a Domicilio | DIFIORI",
    description:
      "Encuentra ramos de flores en Guayaquil para cumpleanos, aniversarios y regalos romanticos. DIFIORI entrega ramos y arreglos florales a domicilio.",
    keywords: "ramos de flores, ramos de flores Guayaquil, ramos a domicilio Guayaquil, ramos de rosas Guayaquil",
    h1: "Ramos de flores",
    intro:
      "Nuestros ramos de flores estan pensados para regalar emociones: rosas, flores mixtas y composiciones elegantes listas para enviar en Guayaquil.",
    focus: ["Ramos para amor y aniversario", "Ramos de rosas y flores mixtas", "Opciones con regalos complementarios"],
    related: ["/flores-guayaquil", "/arreglos-de-flores-guayaquil", "/arreglos-florales-guayaquil"],
  },
  "/arreglos-de-flores-guayaquil": {
    path: "/arreglos-de-flores-guayaquil",
    title: "Arreglos de Flores en Guayaquil | Entrega a Domicilio | DIFIORI",
    description:
      "Compra arreglos de flores en Guayaquil con entrega a domicilio. DIFIORI prepara arreglos florales, ramos y regalos para ocasiones especiales.",
    keywords: "arreglos de flores en Guayaquil, arreglos florales Guayaquil, arreglos de flores a domicilio Guayaquil, floreria Guayaquil",
    h1: "Arreglos de flores en Guayaquil",
    intro:
      "En DIFIORI encuentras arreglos de flores en Guayaquil para cumpleaños, amor, aniversarios, condolencias y regalos especiales, con pedidos online y entrega a domicilio.",
    focus: ["Arreglos de flores frescas", "Entrega a domicilio en Guayaquil", "Pedidos rápidos por tienda o WhatsApp"],
    related: ["/arreglos-florales-guayaquil", "/flores-guayaquil", "/floreria-guayaquil"],
  },
  "/arreglos-florales-guayaquil": {
    path: "/arreglos-florales-guayaquil",
    title: "Arreglos Florales Guayaquil | Flores a Domicilio | DIFIORI",
    description:
      "Arreglos florales en Guayaquil para regalos, cumpleaños, amor y condolencias. Compra en DIFIORI con entrega a domicilio.",
    keywords: "arreglos florales Guayaquil, arreglos florales a domicilio Guayaquil, flores Guayaquil, floreria Guayaquil",
    h1: "Arreglos florales Guayaquil",
    intro:
      "DIFIORI diseña arreglos florales en Guayaquil con flores frescas, composición elegante y atención directa para que tu detalle llegue a domicilio.",
    focus: ["Diseños florales para regalar", "Flores frescas en Guayaquil", "Compra online o por WhatsApp"],
    related: ["/arreglos-de-flores-guayaquil", "/floreria-guayaquil", "/ramos-de-flores"],
  },
} as const;

type LandingPath = keyof typeof landingPages;

function useCurrentLandingPage() {
  const [floresMatch] = useRoute("/flores-guayaquil");
  const [floreriaMatch] = useRoute("/floreria-guayaquil");
  const [floreriasMatch] = useRoute("/florerias-en-guayaquil");
  const [ramosMatch] = useRoute("/ramos-de-flores");
  const [arreglosFloresMatch] = useRoute("/arreglos-de-flores-guayaquil");
  const [arreglosFloralesMatch] = useRoute("/arreglos-florales-guayaquil");

  if (floresMatch) return landingPages["/flores-guayaquil"];
  if (floreriaMatch) return landingPages["/floreria-guayaquil"];
  if (floreriasMatch) return landingPages["/florerias-en-guayaquil"];
  if (ramosMatch) return landingPages["/ramos-de-flores"];
  if (arreglosFloresMatch) return landingPages["/arreglos-de-flores-guayaquil"];
  if (arreglosFloralesMatch) return landingPages["/arreglos-florales-guayaquil"];

  return landingPages["/flores-guayaquil"];
}

export const SEO_LANDING_PATHS = Object.keys(landingPages) as LandingPath[];

export default function SeoLandingPage() {
  const page = useCurrentLandingPage();
  const { data: products = [], isLoading } = useProducts();
  const relatedPages = page.related.map((path) => landingPages[path]);
  const highlightedProducts = products
    .filter((product) => {
      const text = `${product.name} ${product.category} ${product.description}`.toLowerCase();
      return text.includes("flor") || text.includes("ramo") || text.includes("rosa");
    })
    .slice(0, 6);
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: page.h1,
        url: canonicalUrl(page.path),
        description: page.description,
        image: absoluteUrl("/opengraph.jpg"),
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Inicio",
              item: canonicalUrl("/"),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: page.h1,
              item: canonicalUrl(page.path),
            },
          ],
        },
      },
      {
        "@type": "Florist",
        "@id": `${canonicalUrl("/")}#organization`,
        name: DEFAULT_COMPANY.name,
        url: canonicalUrl("/"),
        image: absoluteUrl("/opengraph.jpg"),
        telephone: `+${DEFAULT_COMPANY.phoneDigits}`,
        email: DEFAULT_COMPANY.email,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          addressLocality: DEFAULT_COMPANY.city,
          addressCountry: "EC",
        },
        areaServed: ["Guayaquil"],
      },
    ],
  };

  return (
    <main className="page-shell">
      <Seo
        title={page.title}
        description={page.description}
        keywords={page.keywords}
        path={page.path}
        robots="index, follow"
        image="/opengraph.jpg"
        type="website"
        schema={pageSchema}
      />

      <div className="page-container">
        <div className="page-header">
          <div className="page-kicker">DIFIORI Guayaquil</div>
          <h1 className="page-title">{page.h1}</h1>
          <p className="page-copy">{page.intro}</p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {page.focus.map((item) => (
            <article key={item} className="surface-card p-6">
              <Flower2 className="mb-5 h-7 w-7 text-accent" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-foreground">{item}</h2>
            </article>
          ))}
        </section>

        <section className="mt-14 grid gap-6 rounded-[1.5rem] border border-primary/15 bg-white/70 p-6 md:grid-cols-3">
          <div className="flex gap-4">
            <MapPin className="mt-1 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">Cobertura local</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                Entregamos flores, ramos y arreglos florales a domicilio en Guayaquil.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Truck className="mt-1 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">Entrega a domicilio</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                Preparamos arreglos florales y ramos de flores para regalos, fechas especiales y sorpresas.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <MessageSquare className="mt-1 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">Compra facil</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                Haz tu pedido en la tienda online o escribe por WhatsApp para confirmar disponibilidad.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-[1.5rem] border border-primary/15 bg-white/70 p-6">
          <div className="max-w-4xl">
            <h2 className="section-title">Florería en Guayaquil con entrega rápida y servicio local</h2>
            <p className="section-copy">
              En DIFIORI somos una florería en Guayaquil especializada en arreglos florales, ramos de flores y regalos a domicilio. Nuestra tienda online está optimizada para que encuentres rápidamente flores para cumpleaños, aniversarios, amor, condolencias y celebraciones especiales.
            </p>
            <p className="section-copy">
              Si buscas florerías en Guayaquil, aquí tienes envíos rápidos, atención directa por WhatsApp y decoraciones florales frescas que garantizan una experiencia profesional y confiable.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6">
            <h2 className="section-title">Búsquedas relacionadas</h2>
            <p className="section-copy">
              También puedes encontrar DIFIORI por estas formas comunes de buscar flores y arreglos en Guayaquil.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedPages.map((relatedPage) => (
              <Link
                key={relatedPage.path}
                href={relatedPage.path}
                className="surface-card p-6 transition-transform hover:-translate-y-1"
              >
                <h3 className="text-xl font-semibold text-foreground">{relatedPage.h1}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                  {relatedPage.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="section-title">Arreglos destacados</h2>
              <p className="section-copy">Flores y regalos disponibles para enviar en Guayaquil.</p>
            </div>
            <Link href="/shop" className="ui-btn-secondary">
              Ver catalogo
            </Link>
          </div>

          {isLoading ? (
            <div className="product-grid">
              {Array(6).fill(0).map((_, index) => (
                <div key={index} className="product-skeleton" />
              ))}
            </div>
          ) : highlightedProducts.length > 0 ? (
            <div className="product-grid">
              {highlightedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-state-title">Explora el catalogo completo de DIFIORI.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
