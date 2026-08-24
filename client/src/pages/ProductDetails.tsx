import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, Plus, Truck, ShieldCheck, Clock, ShoppingBag, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getResponsiveImageSrcSet } from "@/lib/media";
import { useProducts } from "@/hooks/useProducts";
import { useCompany } from "@/hooks/useCompany";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Seo } from "@/components/Seo";
import { buildGaItem, trackGaEvent } from "@/lib/analytics";
import { trackFacebookEvent } from "@/lib/facebook-pixel";
import { DEFAULT_COMPANY, absoluteUrl, canonicalUrl } from "@/lib/site";
import {
  MERCHANT_ORGANIZATION_ID,
  getMerchantOrganizationSchema,
  getMerchantReturnPolicySchema,
  getOfferShippingDetailsSchema,
} from "@/lib/merchant-seo";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  formatCategoryDisplayName,
  getCategoryPath,
  getNumericPriceValue,
  getProductPath,
  getProductSku,
  isProductSlugMatch,
} from "@shared/catalog";

export default function ProductDetails() {
  React.useEffect(() => {
    void import("./product-details.css");
  }, []);

  const [location, setLocation] = useLocation();
  const { data: allProducts = [], isLoading } = useProducts();
  const { data: company } = useCompany();
  const { addItem, buyNow, setIsCartOpen } = useCart();
  const { toast } = useToast();

  const routePath = getCleanRoutePath(location);
  const canonicalMatch = routePath.startsWith("/producto/");
  const legacyMatch = routePath.startsWith("/product/");
  const routeValue = decodeURIComponent(
    routePath.replace(/^\/producto\//, "").replace(/^\/product\//, ""),
  );
  const product = allProducts.find((item) => {
    if (!routeValue) return false;

    if (legacyMatch) {
      return String(item.id) === String(routeValue);
    }

    return isProductSlugMatch(item, routeValue);
  });
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
  const [isBuying, setIsBuying] = useState(false);

  React.useEffect(() => {
    if (product) setSelectedImage(product.image);
  }, [product]);

  React.useEffect(() => {
    if (!product) return;

    trackGaEvent("view_item", {
      currency: "USD",
      value: getNumericPriceValue(product.price),
      items: [
        buildGaItem({
          id: getProductSku(product),
          name: product.name,
          category: formatCategoryDisplayName(product.category),
          price: getNumericPriceValue(product.price),
        }),
      ],
    });
    trackFacebookEvent("ViewContent", {
      content_ids: [getProductSku(product)],
      content_name: product.name,
      content_category: formatCategoryDisplayName(product.category),
      content_type: "product",
      currency: "USD",
      value: getNumericPriceValue(product.price),
    });
  }, [product]);

  React.useEffect(() => {
    if (!product) return;

    const canonicalPath = getProductPath(product);
    if (routePath !== canonicalPath) {
      setLocation(canonicalPath, { replace: true });
    }
  }, [product, routePath, setLocation]);

  const isStoreClosed = () => {
    if (company?.settings?.acceptOrders !== false) return false;

    toast({
      title: "Tienda cerrada temporalmente",
      description: "Por ahora no estamos recibiendo nuevos pedidos.",
      duration: 4000,
    });
    return true;
  };

  const trackProductAddToCart = () => {
    if (!product) return;

    trackGaEvent("add_to_cart", {
      currency: "USD",
      value: getNumericPriceValue(product.price),
      items: [
        buildGaItem({
          id: getProductSku(product),
          name: product.name,
          category: formatCategoryDisplayName(product.category),
          price: getNumericPriceValue(product.price),
        }),
      ],
    });
    trackFacebookEvent("AddToCart", {
      content_ids: [getProductSku(product)],
      content_name: product.name,
      content_type: "product",
      currency: "USD",
      value: getNumericPriceValue(product.price),
    });
  };

  const handleAddToCart = () => {
    if (!product || isStoreClosed()) return;

    trackProductAddToCart();
    addItem(product);
    setIsCartOpen(true);
  };

  const handleBuyNow = () => {
    if (!product || isBuying || isStoreClosed()) return;

    setIsBuying(true);
    trackProductAddToCart();
    buyNow(product);
    setLocation("/checkout");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Seo
          title="Cargando producto | DIFIORI"
          description="Cargando información del producto."
          path={routePath}
          robots="noindex, nofollow"
        />
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page-shell">
        <Seo
          title="Producto no encontrado | DIFIORI"
          description="La ficha del producto solicitado no está disponible."
          path={routePath}
          robots="noindex, nofollow"
        />
        <div className="empty-state mx-auto max-w-2xl">
          <h1 className="section-title">Producto no encontrado</h1>
          <p className="section-copy mb-8">La ficha solicitada no está disponible en el catálogo público.</p>
          <Link href="/shop" className="ui-btn-primary">
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const priceValue = getNumericPriceValue(product.price);
  const productSku = getProductSku(product);
  const productPath = getProductPath(product);
  const categoryPath = getCategoryPath(product.category);
  const categoryLabel = formatCategoryDisplayName(product.category);
  const galleryImages = Array.from(
    new Set([product.image, ...(product.additionalImages || [])].filter(Boolean))
  );
  const normalizedDescription = (product.description || "").trim().toLowerCase();
  const normalizedIncludes = (product.includes || "").trim().toLowerCase();
  const normalizedSize = normalizeProductDetailValue(product.size);
  const detailItems = [
    normalizedIncludes && normalizedIncludes !== normalizedDescription
      ? {
          title: "Lo que recibes",
          content: product.includes,
        }
      : null,
    normalizedSize
      ? {
          title: "Dimensiones",
          content: normalizedSize,
        }
      : null,
    product.deliveryTime
      ? {
          title: "Promesa de Entrega",
          content: (
            <p className="flex items-center gap-2 text-[1.05rem] font-medium leading-relaxed text-[#8F73B1]">
              <Clock className="w-4 h-4" /> {product.deliveryTime} (Guayaquil)
            </p>
          ),
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    content: React.ReactNode;
  }>;
  const productSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${canonicalUrl(productPath)}#product`,
        name: product.name,
        description: product.description || `${product.name} con entrega a domicilio en Guayaquil.`,
        sku: productSku,
        mpn: productSku,
        image: galleryImages.map((image) => absoluteUrl(image)),
        category: categoryLabel,
        brand: {
          "@type": "Brand",
          name: "DIFIORI",
        },
        offers: {
          "@type": "Offer",
          url: canonicalUrl(productPath),
          priceCurrency: "USD",
          price: priceValue,
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          shippingDetails: getOfferShippingDetailsSchema(),
          hasMerchantReturnPolicy: getMerchantReturnPolicySchema(),
          seller: {
            "@id": MERCHANT_ORGANIZATION_ID,
          },
        },
      },
      getMerchantOrganizationSchema(),
      {
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
          {
            "@type": "ListItem",
            position: 3,
            name: categoryLabel,
            item: canonicalUrl(categoryPath),
          },
          {
            "@type": "ListItem",
            position: 4,
            name: product.name,
            item: canonicalUrl(productPath),
          },
        ],
      },
    ],
  };
  const selectedImageSrcSet = getResponsiveImageSrcSet(selectedImage, [480, 768, 1024, 1280]);

  return (
    <div className="page-shell">
      <Seo
        title={`${product.name} | Arreglos Florales en Guayaquil | DIFIORI`}
        description={product.description}
        path={productPath}
        image={product.image}
        type="product"
        schema={productSchema}
      />
      <div className="page-container">
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
              <Link href={categoryPath} className="transition-colors hover:text-foreground">
                {categoryLabel}
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{product.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid items-start gap-14 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-8 flex flex-col items-center lg:items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="surface-card relative aspect-[4/5] w-full max-w-xl overflow-hidden group bg-white"
            >
              <img
                src={selectedImage}
                srcSet={selectedImageSrcSet}
                className="w-full h-full object-contain object-center p-6 transition-transform duration-700 group-hover:scale-[1.02] cursor-zoom-in"
                alt={product.name}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                sizes="(min-width: 1024px) 50vw, 92vw"
              />
            </motion.div>

            {galleryImages.length > 1 ? (
              <div className="flex gap-4 justify-center lg:justify-start w-full max-w-xl overflow-x-auto pb-4 no-scrollbar">
                {galleryImages.map((img, i) => {
                  const thumbnailSrcSet = getResponsiveImageSrcSet(img, [96, 192, 256]);

                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Ver imagen ${i + 1} de ${product.name}`}
                      onMouseEnter={() => setSelectedImage(img)}
                      onClick={() => setSelectedImage(img)}
                      className={cn(
                        "h-24 w-24 min-w-[6rem] overflow-hidden rounded-2xl border-2 bg-white transition-all hover:scale-105",
                        selectedImage === img ? "border-accent shadow-lg" : "border-primary/10",
                      )}
                    >
                      <img
                        src={img}
                        srcSet={thumbnailSrcSet}
                        className="w-full h-full object-contain object-center p-1"
                        alt={`${product.name} vista ${i + 1}`}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        sizes="96px"
                      />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col h-full">
            <div className="page-kicker">{categoryLabel}</div>

            <h1 className="page-title mb-8">
              {product.name}
            </h1>

            <div className="flex items-center gap-6 mb-12">
              <span className="text-5xl font-black text-foreground font-serif underline decoration-accent/20 underline-offset-8 decoration-4">
                {product.price}
              </span>
              <div className="px-4 py-1 bg-accent/10 text-accent rounded-full text-[10px] font-black uppercase tracking-widest border border-accent/20">
                Disponible Ahora
              </div>
            </div>

            <p className="product-description-strong mb-10 max-w-2xl">
              {product.description}
            </p>

            {detailItems.length > 0 ? (
              <div className="mb-16 grid grid-cols-1 gap-8 sm:grid-cols-2">
                {detailItems.map((item) => (
                  <div key={item.title} className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                      {item.title}
                    </h4>
                    {typeof item.content === "string" ? (
                      <p className="text-[1.05rem] font-medium leading-relaxed text-[#8F73B1]">
                        {item.content}
                      </p>
                    ) : (
                      item.content
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-6 mt-auto">
              <button type="button" onClick={handleBuyNow} disabled={isBuying} className="ui-btn-primary flex-1 py-5">
                {isBuying ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShoppingBag className="h-5 w-5" />
                )}
                {isBuying ? "Cargando..." : "Comprar ahora"}
              </button>
              <button type="button" onClick={handleAddToCart} className="ui-btn-secondary flex-1 py-5">
                <Plus className="h-5 w-5" /> Agregar al carrito
              </button>
              <a
                href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}?text=Hola!%20Deseo%20ordenar%20el%20arreglo:%20${encodeURIComponent(product.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-btn-secondary flex-1 py-5"
              >
                <MessageSquare className="h-5 w-5" /> Pedir por WhatsApp
              </a>
            </div>

            <div className="mt-12 pt-12 border-t border-primary/10 flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-foreground/30">
              <span className="flex items-center gap-2">
                <Truck className="w-4 h-4" /> Envío Seguro
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Pago Protegido
              </span>
            </div>
          </div>
        </div>
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

function normalizeProductDetailValue(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "-" || normalized === "—" || normalized.toLowerCase() === "n/a") {
    return "";
  }

  return normalized;
}
