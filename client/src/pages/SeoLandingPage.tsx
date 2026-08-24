import { Link, useRoute } from "wouter";
import { Flower2, MapPin, MessageSquare, Truck } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { Seo } from "@/components/Seo";
import { useProducts } from "@/hooks/useProducts";
import { DEFAULT_COMPANY, absoluteUrl, canonicalUrl } from "@/lib/site";
import { getProductPath } from "@shared/catalog";

const landingPages = {
  "/flores-guayaquil": {
    path: "/flores-guayaquil",
    title: "Flores en Guayaquil | Flores a Domicilio | DIFIORI",
    description:
      "Compra flores frescas y ramos de flores en Guayaquil con entrega a domicilio, atención personalizada y opciones ideales para regalar.",
    keywords: "flores en Guayaquil, flores a domicilio Guayaquil, arreglos florales Guayaquil, comprar flores Guayaquil, pedidos de flores Guayaquil",
    h1: "Flores en Guayaquil",
    intro:
      "DIFIORI prepara flores frescas, ramos y arreglos florales para entregas a domicilio en Guayaquil. Creamos detalles para cumpleanos, aniversarios, amor, condolencias y regalos especiales.",
    focus: ["Flores frescas seleccionadas", "Entrega a domicilio en Guayaquil", "Pedidos por tienda online o WhatsApp"],
    preferredCategories: ["Ramo de Flores", "Arreglo con Frutas", "Flores para Aniversario", "Nacimiento"],
    productTerms: ["flor", "gerbera", "girasol", "rosa", "lirio"],
    serviceCards: [
      ["Flores para hoy", "Priorizamos arreglos listos para coordinar entregas rápidas en Guayaquil."],
      ["Entrega por sector", "Confirmamos dirección, horario y disponibilidad antes de preparar el pedido."],
      ["Pedido asistido", "Puedes comprar online o escribir por WhatsApp si necesitas una recomendación urgente."],
    ],
    bodyTitle: "Flores en Guayaquil para enviar hoy",
    bodyCopy: [
      "Esta página está pensada para quien necesita flores frescas con entrega rápida en Guayaquil. Aquí destacamos opciones versátiles para cumpleaños, agradecimientos, amor y detalles espontáneos.",
      "Antes del despacho confirmamos disponibilidad, sector y franja horaria para que el regalo llegue con una experiencia cuidada.",
    ],
    related: ["/arreglos-de-flores-guayaquil", "/floreria-guayaquil", "/ramos-de-flores"],
  },
  "/floreria-guayaquil": {
    path: "/floreria-guayaquil",
    title: "Floreria Guayaquil | Pedidos a Domicilio | DIFIORI",
    description:
      "Florería en Guayaquil con pedidos a domicilio, flores y regalos para distintas ocasiones y presupuestos, con atención directa para comprar fácilmente.",
    keywords: "floreria Guayaquil, floreria en Guayaquil, flores en Guayaquil, flores a domicilio Guayaquil, ramos de flores Guayaquil",
    h1: "Floreria Guayaquil",
    intro:
      "DIFIORI es una floreria en Guayaquil con flores frescas, pedidos a domicilio y atención directa para enviar detalles para cada ocasión.",
    focus: ["Arreglos florales personalizados", "Atencion directa por WhatsApp", "Entrega a domicilio en Guayaquil"],
    preferredCategories: ["Ramo de Flores", "Arreglo con Frutas", "Flores para Aniversario", "Nacimiento"],
    productTerms: ["flor", "rosa", "arreglo", "ramo"],
    serviceCards: [
      ["Atención local", "Te atendemos con asesoría directa para elegir el detalle correcto según ocasión."],
      ["Cobertura Guayaquil", "Coordinamos entregas por sector y validamos horarios antes del despacho."],
      ["Confianza DIFIORI", "Pedidos online, WhatsApp, pagos seguros y confirmación del equipo."],
    ],
    bodyTitle: "Florería local en Guayaquil con atención personalizada",
    bodyCopy: [
      "Esta página refuerza la confianza de marca: DIFIORI funciona como florería local para compras rápidas, regalos programados y pedidos con asesoría humana.",
      "Si tienes dudas sobre disponibilidad, colores o sector de entrega, nuestro equipo confirma los detalles antes de preparar el arreglo.",
    ],
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
      "Si buscas florerias en Guayaquil, DIFIORI combina flores frescas y atención directa para ayudarte a enviar un detalle el mismo día o en fecha programada.",
    focus: ["Arreglos florales personalizados", "Atencion directa por WhatsApp", "Entrega a domicilio en Guayaquil"],
    preferredCategories: ["Ramo de Flores", "Arreglo con Frutas", "Flores para Aniversario", "Nacimiento"],
    productTerms: ["flor", "arreglo", "ramo", "rosa"],
    serviceCards: [
      ["Comparar opciones", "Encuentra ramos, cajas y arreglos sin saltar entre varias tiendas."],
      ["Compra guiada", "Te orientamos por WhatsApp cuando necesitas elegir rápido."],
      ["Entrega confiable", "Confirmamos datos del pedido y destino antes del despacho."],
    ],
    bodyTitle: "Una florería en Guayaquil para comprar con menos duda",
    bodyCopy: [
      "DIFIORI concentra opciones florales y regalos para quienes comparan florerías en Guayaquil y buscan una compra confiable.",
      "La experiencia está pensada para resolver rápido: producto, pago, horario y confirmación por WhatsApp.",
    ],
    related: ["/floreria-guayaquil", "/arreglos-florales-guayaquil", "/flores-guayaquil"],
  },
  "/ramos-de-flores": {
    path: "/ramos-de-flores",
    title: "Ramos de Flores en Guayaquil | Ramos a Domicilio | DIFIORI",
    description:
      "Encuentra ramos de flores en Guayaquil para cumpleaños, aniversarios y regalos románticos con entrega a domicilio y opciones para distintos presupuestos.",
    keywords: "ramos de flores, ramos de flores Guayaquil, ramos a domicilio Guayaquil, ramos de rosas Guayaquil",
    h1: "Ramos de flores",
    intro:
      "Nuestros ramos de flores están pensados para regalar emociones: rosas, flores mixtas y opciones listas para enviar en Guayaquil.",
    focus: ["Ramos para amor y aniversario", "Ramos de rosas y flores mixtas", "Opciones con regalos complementarios"],
    preferredCategories: ["Ramo de Flores"],
    productTerms: ["ramo", "bouquet", "rosa", "rosas", "aniversario"],
    serviceCards: [
      ["Ramos románticos", "Opciones con rosas y flores mixtas para amor y aniversario."],
      ["Celebraciones", "Ramos para cumpleaños, graduaciones y detalles que deben verse memorables."],
      ["Complementos", "Puedes combinar flores con chocolates, globos o peluches según disponibilidad."],
    ],
    bodyTitle: "Ramos de flores para romance y celebración",
    bodyCopy: [
      "Esta página prioriza bouquets, rosas y ramos florales para aniversarios, cumpleaños y detalles románticos en Guayaquil.",
      "Si buscas un ramo con color específico o complemento, confirma por WhatsApp y te ayudamos a elegir una alternativa disponible.",
    ],
    related: ["/flores-guayaquil", "/arreglos-de-flores-guayaquil", "/arreglos-florales-guayaquil"],
  },
  "/arreglos-de-flores-guayaquil": {
    path: "/arreglos-de-flores-guayaquil",
    title: "Arreglos de Flores en Guayaquil | Entrega a Domicilio | DIFIORI",
    description:
      "Compra arreglos de flores en Guayaquil con entrega a domicilio y opciones para cumpleaños, amor y celebraciones especiales, en distintos presupuestos.",
    keywords: "arreglos de flores en Guayaquil, arreglos florales Guayaquil, arreglos de flores a domicilio Guayaquil, floreria Guayaquil",
    h1: "Arreglos de flores en Guayaquil",
    intro:
      "En DIFIORI encuentras arreglos de flores en Guayaquil para cumpleaños, amor, aniversarios, condolencias y regalos especiales, con pedidos online y entrega a domicilio.",
    focus: ["Arreglos de flores frescas", "Entrega a domicilio en Guayaquil", "Pedidos rápidos por tienda o WhatsApp"],
    preferredCategories: ["Arreglo con Frutas", "Flores para Aniversario"],
    productTerms: ["arreglo", "caja", "frutas", "desayuno", "chocolate", "fresas"],
    serviceCards: [
      ["Cajas y composiciones", "Arreglos en caja, bases y combinaciones florales para regalar en grande o con un detalle sencillo."],
      ["Regalos completos", "Opciones con frutas, chocolates, globos, desayunos y detalles complementarios."],
      ["Ocasiones especiales", "Cumpleaños, amor, condolencias, aniversarios y sorpresas programadas."],
    ],
    bodyTitle: "Arreglos de flores, cajas y regalos especiales",
    bodyCopy: [
      "Esta página destaca composiciones más elaboradas: cajas florales, arreglos con frutas, desayunos sorpresa y detalles combinados.",
      "Son opciones ideales cuando quieres un regalo más completo que un ramo tradicional.",
    ],
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
      "DIFIORI prepara arreglos florales en Guayaquil con flores frescas y atención directa para que tu detalle llegue a domicilio.",
    focus: ["Diseños florales para regalar", "Flores frescas en Guayaquil", "Compra online o por WhatsApp"],
    preferredCategories: ["Arreglo con Frutas", "Flores para Aniversario", "Ramo de Flores"],
    productTerms: ["arreglo", "floral", "flores", "rosas", "condolencias"],
    serviceCards: [
      ["Diseño floral", "Composiciones cuidadas para transmitir amor, gratitud, condolencias o celebración."],
      ["Disponibilidad real", "Si una flor cambia por temporada, coordinamos una alternativa antes de despachar."],
      ["Entrega coordinada", "Validamos dirección, horario y mensaje de tarjeta antes del envío."],
    ],
    bodyTitle: "Arreglos florales con diseño y coordinación",
    bodyCopy: [
      "Esta página se enfoca en arreglos florales, flores combinadas y presentaciones para distintas emociones y presupuestos.",
      "La prioridad es que el arreglo mantenga intención, estética y confianza desde la compra hasta la entrega.",
    ],
    related: ["/arreglos-de-flores-guayaquil", "/floreria-guayaquil", "/ramos-de-flores"],
  },
} as const;

type LandingPath = keyof typeof landingPages;

function normalizeCatalogText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

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
  const preferredCategories = page.preferredCategories.map(normalizeCatalogText);
  const categoryMatches = products.filter((product) =>
    preferredCategories.includes(normalizeCatalogText(product.category)),
  );
  const highlightedProducts = (page.path === "/floreria-guayaquil"
    ? [...categoryMatches.filter((product) => product.isBestSeller), ...categoryMatches]
    : categoryMatches
  )
    .filter((product, index, list) => list.findIndex((candidate) => candidate.id === product.id) === index)
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
      ...(highlightedProducts.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${canonicalUrl(page.path)}#itemlist`,
              name: `${page.h1} - productos recomendados`,
              itemListElement: highlightedProducts.map((product, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: canonicalUrl(getProductPath(product)),
                name: product.name,
              })),
            },
          ]
        : []),
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
          {page.serviceCards.map(([title, copy], index) => {
            const Icon = index === 0 ? MapPin : index === 1 ? Truck : MessageSquare;
            return (
              <div key={title} className="flex gap-4">
                <Icon className="mt-1 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                    {copy}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-16 rounded-[1.5rem] border border-primary/15 bg-white/70 p-6">
          <div className="max-w-4xl">
            <h2 className="section-title">{page.bodyTitle}</h2>
            {page.bodyCopy.map((copy) => (
              <p key={copy} className="section-copy">
                {copy}
              </p>
            ))}
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
              {highlightedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  showBestSellerBadge={index < 2}
                />
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
