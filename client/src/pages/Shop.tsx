import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/ProductCard";
import { CategorySidebar } from "@/components/CategorySidebar";
import { Seo } from "@/components/Seo";
import { absoluteUrl, canonicalUrl } from "@/lib/site";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "wouter";

export default function Shop() {
  const { data: allProducts = [], isLoading } = useProducts();
  const shopSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Catálogo DIFIORI",
    url: canonicalUrl("/shop"),
    description: "Catálogo de arreglos florales, ramos de flores y regalos a domicilio en Guayaquil.",
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
          name: "Catálogo",
          item: canonicalUrl("/shop"),
        },
      ],
    },
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
          <p className="page-copy">Arreglos florales diseñados para trascender.</p>
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
              <div className="product-grid">
                {allProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
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
