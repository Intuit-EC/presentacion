import React from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { getResponsiveImageSrcSet } from "@/lib/media";
import {
  formatCategoryDisplayName,
  getCategoryPath,
  getCategorySlug,
  getNumericPriceValue,
} from "@shared/catalog";
import "./home-catalog.css";

const HOME_FEATURED_PRODUCTS = 4;

export function HomeCatalogSection() {
  const { data: allProducts = [], isLoading: isLoadingAll } = useProducts();
  // La lista de categorias se renderiza desde el servidor y pesa unos pocos
  // cientos de bytes, asi que las colecciones se ven apenas abre la pagina.
  // El catalogo completo llega despues y solo agrega foto, cantidad y precio.
  const { data: categoryNames = [] } = useCategories();

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
        image: cover?.image || "",
        count: products.length,
        fromPrice: prices.length > 0 ? Math.min(...prices) : null,
      };
    });
  }, [allProducts, categoryNames]);

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
        <div id="catalogo" className="home-catalog-header">
          <div className="home-catalog-line" />
          <h2 className="home-catalog-title">Nuestras colecciones</h2>
          <div className="home-catalog-line" />
        </div>

        <div id="product-list" className="home-catalog-list">
          {collections.length === 0 && isLoadingAll ? (
            <div className="home-collection-grid">
              {Array(6)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="home-collection-skeleton" />
                ))}
            </div>
          ) : collections.length > 0 ? (
            <>
              <div className="home-collection-grid">
                {collections.map((collection, index) => (
                  <Link
                    key={collection.slug}
                    href={collection.href}
                    className="home-collection-card"
                  >
                    <span className="home-collection-media">
                      {collection.image ? (
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
                      ) : null}
                    </span>
                    <span className="home-collection-body">
                      <strong className="home-collection-name">{collection.label}</strong>
                      <small className="home-collection-meta">
                        {collection.count > 0
                          ? `${collection.count} ${collection.count === 1 ? "opción" : "opciones"}${
                              collection.fromPrice !== null
                                ? ` · desde $${collection.fromPrice.toFixed(2)}`
                                : ""
                            }`
                          : "Ver colección"}
                      </small>
                    </span>
                    <ArrowRight className="home-collection-arrow" aria-hidden="true" />
                  </Link>
                ))}
              </div>

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
