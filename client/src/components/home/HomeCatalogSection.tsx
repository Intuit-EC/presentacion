import React from "react";
import { Link } from "wouter";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";
import { formatCategoryDisplayName, getCategoryPath } from "@shared/catalog";
import "./home-catalog.css";

const HOME_PRODUCTS_PER_CATEGORY = 2;
const HOME_CATEGORY_LIMIT = 4;
const HOME_PRODUCT_LIMIT = HOME_PRODUCTS_PER_CATEGORY * HOME_CATEGORY_LIMIT;

export function HomeCatalogSection() {
  const { data: allProducts = [], isLoading: isLoadingAll } = useProducts({
    limit: HOME_PRODUCT_LIMIT,
  });

  const categorySections = React.useMemo(() => {
    const sections = new Map<string, typeof allProducts>();

    for (const product of allProducts) {
      const category = product.category || "General";
      const existing = sections.get(category) || [];
      existing.push(product);
      sections.set(category, existing);
    }

    return Array.from(sections.entries())
      .map(([category, products]) => ({
        category,
        label: formatCategoryDisplayName(category),
        href: getCategoryPath(category),
        products: products.slice(0, HOME_PRODUCTS_PER_CATEGORY),
      }))
      .slice(0, HOME_CATEGORY_LIMIT);
  }, [allProducts]);

  return (
    <section className="home-catalog-section">
      <aside className="home-catalog-sidebar">
        <CategorySidebar variant="link" enabled />
      </aside>

      <main className="home-catalog-main">
        <div id="catalogo" className="home-catalog-header">
          <div className="home-catalog-line" />
          <h2 className="home-catalog-title">
            Elige el detalle perfecto
          </h2>
          <div className="home-catalog-line" />
        </div>

        <div id="product-list" className="home-catalog-list">
          {isLoadingAll ? (
            Array(6)
              .fill(0)
              .map((_, i) => <div key={i} className="product-skeleton" />)
          ) : categorySections.length > 0 ? (
            categorySections.map((section) => (
              <section key={section.category} className="home-catalog-group">
                <div className="home-catalog-group-head">
                  <div>
                    <h2 className="home-catalog-group-title">{section.label}</h2>
                    <p className="home-catalog-group-copy">
                      Opciones favoritas de {section.label.toLowerCase()} listas para sorprender en Guayaquil.
                    </p>
                  </div>
                  <Link href={section.href} className="ui-btn-secondary home-catalog-cta">
                    Ver todos
                  </Link>
                </div>

                <div className="product-grid">
                  {section.products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="empty-state col-span-full">
              <p className="empty-state-title">No se encontraron productos en esta categoria.</p>
            </div>
          )}
        </div>

        <div className="home-catalog-footer">
          <Link href="/shop" className="ui-btn-secondary home-catalog-all">
            Ver Coleccion Completa
          </Link>
        </div>
      </main>
    </section>
  );
}
