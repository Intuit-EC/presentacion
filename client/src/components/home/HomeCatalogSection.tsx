import React from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock3, MessageCircleMore } from "lucide-react";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryCovers } from "@/hooks/useCategoryCovers";
import { useProducts } from "@/hooks/useProducts";
import { PLACEHOLDER_IMAGE, getResponsiveImageSrcSet } from "@/lib/media";
import { DEFAULT_COMPANY } from "@/lib/site";
import {
  formatCategoryDisplayName,
  getCategoryPath,
  getCategorySlug,
  getNumericPriceValue,
} from "@shared/catalog";
import "./home-catalog.css";

const HOME_FEATURED_PRODUCTS = 4;
const HOME_INITIAL_PRODUCTS = 8;

export function HomeCatalogSection() {
  const { data: allProducts = [], isLoading: isLoadingAll } = useProducts({
    limit: HOME_INITIAL_PRODUCTS,
    summary: true,
  });
  // La lista de categorias se renderiza desde el servidor y pesa unos pocos
  // cientos de bytes, asi que las colecciones se ven apenas abre la pagina.
  // La portada solo toma una vitrina corta para mantener el primer scroll agil.
  const { data: categoryNames = [] } = useCategories();
  // Portada por categoria calculada sobre todo el catalogo activo, no solo la
  // vitrina corta de arriba: con 8 productos de muestra la mayoria de las
  // categorias no tenian ningun producto propio y se quedaban sin imagen.
  const { data: categoryCovers } = useCategoryCovers();

  const collections = React.useMemo(() => {
    const grouped = new Map<string, typeof allProducts>();

    for (const product of allProducts) {
      const categoryKey = getCategorySlug(product.category || "General");
      const existing = grouped.get(categoryKey) || [];
      existing.push(product);
      grouped.set(categoryKey, existing);
    }

    const orderedKeys = [
      ...categoryNames.map((name) => getCategorySlug(name)),
      ...Array.from(grouped.keys()),
    ];
    const labelBySlug = new Map(categoryNames.map((name) => [getCategorySlug(name), name]));

    return Array.from(new Set(orderedKeys)).map((categorySlug) => {
      const products = grouped.get(categorySlug) || [];
      const category = products[0]?.category || labelBySlug.get(categorySlug) || categorySlug;
      const cover = products.find((product) => product.isBestSeller) || products[0];
      const prices = products
        .map((product) => Number(getNumericPriceValue(product.price)))
        .filter((price) => Number.isFinite(price) && price > 0);

      return {
        slug: categorySlug,
        label: formatCategoryDisplayName(category),
        href: getCategoryPath(category),
        image: categoryCovers?.get(categorySlug) || cover?.image || PLACEHOLDER_IMAGE,
        count: products.length,
        fromPrice: prices.length > 0 ? Math.min(...prices) : null,
      };
    });
  }, [allProducts, categoryNames, categoryCovers]);

  const featuredProducts = React.useMemo(
    () => allProducts.slice(0, HOME_FEATURED_PRODUCTS),
    [allProducts],
  );

  return (
    <section className="home-catalog-section">
      <aside className="home-catalog-sidebar">
        <CategorySidebar variant="link" enabled />
      </aside>

      <main className="home-catalog-main">
        <div className="home-catalog-intro">
          <div>
            <span className="home-catalog-intro-kicker">Flores y regalos en Guayaquil</span>
            <h1 className="home-catalog-intro-title">Flores y regalos en Guayaquil, listos para sorprender</h1>
            <p className="home-catalog-intro-copy">
              Elige tu producto, indica la fecha de entrega y nosotros confirmamos cada detalle por WhatsApp.
            </p>
          </div>
          <div className="home-catalog-intro-actions">
            <Link href="/shop" className="ui-btn-primary home-catalog-intro-button">
              Comprar ahora <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}?text=${encodeURIComponent("Hola, necesito ayuda para elegir un regalo.")}`}
              target="_blank"
              rel="noreferrer"
              className="home-catalog-intro-help"
            >
              <MessageCircleMore className="h-4 w-4" aria-hidden="true" />
              Te ayudamos a elegir
            </a>
          </div>
          <div className="home-catalog-intro-trust" aria-label="Beneficios de comprar en DIFIORI">
            <span><CheckCircle2 aria-hidden="true" /> Pago seguro</span>
            <span><Clock3 aria-hidden="true" /> Entrega coordinada</span>
            <span><MessageCircleMore aria-hidden="true" /> Confirmación por WhatsApp</span>
          </div>
        </div>

        <div id="catalogo" className="home-catalog-header">
          <div className="home-catalog-line" />
          <h2 className="home-catalog-title">Nuestras colecciones</h2>
          <div className="home-catalog-line" />
        </div>

        <div id="product-list" className="home-catalog-list">
          {collections.length === 0 && isLoadingAll ? (
            <div className="home-collection-grid no-scrollbar">
              {Array(6)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="home-collection-skeleton" />
                ))}
            </div>
          ) : collections.length > 0 ? (
            <>
              <div className="home-featured">
                <div className="home-featured-head">
                  <h3 className="home-featured-title">Los más pedidos</h3>
                  <Link href="/shop" className="ui-btn-secondary home-catalog-cta">
                    Ver todo
                  </Link>
                </div>
                <div className="product-grid">
                  {featuredProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      priority={index < 2}
                      showBestSellerBadge={index < 4}
                    />
                  ))}
                </div>
              </div>

              <div className="home-collections-heading">
                <h3>Compra por ocasión</h3>
                <p>Encuentra una opción según la persona, la fecha o tu presupuesto.</p>
              </div>
              <div className="home-collection-grid no-scrollbar">
                {collections.map((collection, index) => (
                  <Link key={collection.slug} href={collection.href} className="home-collection-card">
                    <span className="home-collection-media">
                      <img
                        src={collection.image}
                        srcSet={getResponsiveImageSrcSet(collection.image, [240, 320, 480])}
                        sizes="(min-width: 1024px) 220px, 45vw"
                        alt={`Coleccion ${collection.label} - DIFIORI Guayaquil`}
                        loading={index < 4 ? "eager" : "lazy"}
                        decoding="async"
                        width={320}
                        height={320}
                      />
                    </span>
                    <span className="home-collection-body">
                      <strong className="home-collection-name">{collection.label}</strong>
                      <small className="home-collection-meta">
                        {collection.count > 0
                          ? `${collection.count} ${collection.count === 1 ? "opción" : "opciones"}${collection.fromPrice !== null ? ` · desde $${collection.fromPrice.toFixed(2)}` : ""}`
                          : "Ver colección"}
                      </small>
                    </span>
                    <ArrowRight className="home-collection-arrow" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state col-span-full">
              <p className="empty-state-title">No se encontraron productos en esta categoria.</p>
            </div>
          )}
        </div>

        <div className="home-catalog-footer">
          <Link href="/shop" className="ui-btn-secondary home-catalog-all">
            Ver colección completa
          </Link>
        </div>
      </main>
    </section>
  );
}
