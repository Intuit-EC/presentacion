import { Link, useLocation } from "wouter";
import { useMemo } from "react";
import { ProductCard } from "@/components/ProductCard";
import { CategorySidebar } from "@/components/CategorySidebar";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { Seo } from "@/components/Seo";
import { canonicalUrl } from "@/lib/site";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  BEST_SELLERS_CATEGORY_SLUG,
  areSameCategory,
  findCategoryNameBySlug,
  formatCategoryDisplayName,
  getCategoryDescription,
  getCategoryPath,
  getProductPath,
} from "@shared/catalog";

const BEST_SELLERS_VISIBLE_LIMIT = 10;

export default function CategoryPage() {
  const [location] = useLocation();
  const routePath = getCleanRoutePath(location);
  const slug = decodeURIComponent(routePath.replace(/^\/categoria\//, ""));
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const categoryName = useMemo(() => findCategoryNameBySlug(categories, slug), [categories, slug]);
  const categoryLabel = categoryName ? formatCategoryDisplayName(categoryName) : null;
  const isBestSellers = slug === BEST_SELLERS_CATEGORY_SLUG;
  const { data: allProducts = [], isLoading: isLoadingProducts } = useProducts(
    !isBestSellers && categoryName ? categoryName : undefined,
  );

  const products = useMemo(() => {
    if (!categoryName) return [];
    if (isBestSellers) return allProducts.filter((product) => product.isBestSeller).slice(0, BEST_SELLERS_VISIBLE_LIMIT);
    return allProducts.filter((product) => areSameCategory(product.category, categoryName));
  }, [allProducts, categoryName, isBestSellers]);

  const loading = isLoadingCategories || isLoadingProducts;
  const description = categoryName ? getCategoryDescription(categoryName) : "Colección DIFIORI";
  const categoryPath = getCategoryPath(slug);
  const schema = categoryName
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            name: categoryLabel,
            url: canonicalUrl(categoryPath),
            description,
            breadcrumb: {
              "@id": `${canonicalUrl(categoryPath)}#breadcrumb`,
            },
            mainEntity: products.length > 0 ? { "@id": `${canonicalUrl(categoryPath)}#itemlist` } : undefined,
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${canonicalUrl(categoryPath)}#breadcrumb`,
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
              {
                "@type": "ListItem",
                position: 3,
                name: categoryLabel,
                item: canonicalUrl(categoryPath),
              },
            ],
          },
          ...(products.length > 0
            ? [
                {
                  "@type": "ItemList",
                  "@id": `${canonicalUrl(categoryPath)}#itemlist`,
                  name: `${categoryLabel} DIFIORI`,
                  itemListElement: products.slice(0, 24).map((product, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    url: canonicalUrl(getProductPath(product)),
                    name: product.name,
                  })),
                },
              ]
            : []),
        ],
      }
    : undefined;

  return (
    <div className="page-shell">
      <Seo
        title={
          categoryName
            ? `${categoryLabel} en Guayaquil | Arreglos Florales DIFIORI`
            : "Categoría no encontrada | DIFIORI"
        }
        description={categoryName ? description : "La categoría solicitada no está disponible."}
        path={categoryPath}
        robots={categoryName ? "index, follow" : "noindex, nofollow"}
        schema={schema}
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
              <Link href="/shop" className="transition-colors hover:text-foreground">
                Catálogo
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{categoryLabel || "Categoría"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {categoryName ? (
          <>
            <div className="page-header">
              <div className="page-kicker">Colección DIFIORI</div>
              <h1 className="page-title">{categoryLabel}</h1>
              <p className="page-copy">{description}</p>
            </div>

            <div className="flex flex-col gap-10 lg:flex-row xl:gap-8">
              <aside className="h-fit shrink-0 lg:sticky lg:top-32 lg:w-[280px] xl:w-[300px]">
                <CategorySidebar variant="link" activeCategory={categoryName} />
              </aside>

              <section id="product-list" className="flex-1 scroll-mt-32 overflow-hidden">
                {loading ? (
                  <div className="product-grid">
                    {Array(6)
                      .fill(0)
                      .map((_, index) => (
                        <div key={index} className="product-skeleton" />
                      ))}
                  </div>
                ) : products.length > 0 ? (
                  <div className="product-grid">
                    {products.map((product, index) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        showBestSellerBadge={index < BEST_SELLERS_VISIBLE_LIMIT}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p className="empty-state-title">
                      No encontramos productos disponibles en esta categoría.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <div className="empty-state mx-auto max-w-2xl">
            <h1 className="section-title">Categoría no encontrada</h1>
            <p className="section-copy mb-8">
              La categoría solicitada no existe o fue retirada del catálogo público.
            </p>
            <Link href="/shop" className="ui-btn-primary">
              Volver al catálogo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function getCleanRoutePath(location: string) {
  if (typeof window !== "undefined") {
    return window.location.pathname || "/";
  }

  return String(location || "/").split("?")[0].split("#")[0] || "/";
}
