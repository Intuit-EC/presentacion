import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/ProductCard";
import { CategorySidebar } from "@/components/CategorySidebar";
import { Seo } from "@/components/Seo";
import { absoluteUrl, canonicalUrl } from "@/lib/site";
import { getProductPath } from "@shared/catalog";
import { useMemo, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "wouter";

const INITIAL_VISIBLE_PRODUCTS = 20;
const LOAD_MORE_PRODUCTS = 16;
const BEST_SELLER_BADGE_LIMIT = 10;

export default function Shop() {
  const { data: allProducts = [], isLoading } = useProducts();
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PRODUCTS);
  const visibleProducts = useMemo(
    () => allProducts.slice(0, visibleCount),
    [allProducts, visibleCount],
  );
  const hasMoreProducts = visibleCount < allProducts.length;
  const shopSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Catálogo DIFIORI",
        url: canonicalUrl("/shop"),
        description: "Catálogo de arreglos florales, ramos de flores y regalos a domicilio en Guayaquil.",
        image: absoluteUrl("/opengraph.jpg"),
        breadcrumb: {
          "@id": `${canonicalUrl("/shop")}#breadcrumb`,
        },
        mainEntity: allProducts.length > 0 ? { "@id": `${canonicalUrl("/shop")}#itemlist` } : undefined,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl("/shop")}#breadcrumb`,
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
            name: "Catálogo",
            item: canonicalUrl("/shop"),
          },
        ],
      },
      ...(allProducts.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${canonicalUrl("/shop")}#itemlist`,
              name: "Productos disponibles DIFIORI",
              itemListElement: allProducts.slice(0, 24).map((product, index) => ({
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
    <div className="page-shell">
      <Seo
        title="Catálogo de Arreglos Florales en Guayaquil | DIFIORI"
        description="Explora el catálogo de DIFIORI con ramos de flores, flores mixtas, desayunos sorpresa y regalos a domicilio en Guayaquil."
        path="/shop"
        schema={shopSchema}
      />
      <div className="mx-auto w-full max-w-[1600px] px-6 xl:px-10">
        <Breadcrumb className="mb-10">
          <BreadcrumbList>
            <BreadcrumbItem>
              <Link href="/" className="transition-colors hover:text-foreground">
                Inicio
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Catálogo</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="page-header">
          <div className="page-kicker">Tienda oficial</div>
          <h1 className="page-title">Nuestro Catálogo</h1>
          <p className="page-copy">
            Empieza con una selección curada y carga más productos solo si quieres seguir explorando.
          </p>
        </div>

        <div className="flex flex-col gap-10 lg:flex-row xl:gap-8">
          <aside className="h-fit shrink-0 lg:sticky lg:top-32 lg:w-[280px] xl:w-[300px]">
            <CategorySidebar variant="link" />
          </aside>

          <section id="product-list" className="flex-1 scroll-mt-32 overflow-hidden">
            {isLoading ? (
              <div className="product-grid">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="product-skeleton" />
                ))}
              </div>
            ) : allProducts.length > 0 ? (
              <>
                <div className="mb-6 rounded-2xl border border-primary/15 bg-white/80 px-5 py-4 text-sm font-bold text-[#4A3362] shadow-sm">
                  Mostrando {visibleProducts.length} de {allProducts.length} productos. Usa categorías o carga más para explorar el catálogo completo.
                </div>
                <div className="product-grid">
                  {visibleProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      showBestSellerBadge={index < BEST_SELLER_BADGE_LIMIT}
                    />
                  ))}
                </div>
                {hasMoreProducts ? (
                  <div className="mt-10 flex justify-center">
                    <button
                      type="button"
                      className="ui-btn-secondary"
                      onClick={() => setVisibleCount((current) => current + LOAD_MORE_PRODUCTS)}
                    >
                      Cargar más productos
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">
                <p className="empty-state-title">No hay productos disponibles en este momento.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
