import React from "react";
import type { Product } from "@/data/mock";
import { Link } from "wouter";
import { Loader2, MessageSquare, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { getResponsiveImageSrcSet } from "@/lib/media";
import { DEFAULT_COMPANY, canonicalUrl } from "@/lib/site";
import { formatCategoryDisplayName, getNumericPriceValue, getProductPath, getProductSku } from "@shared/catalog";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { buyNow } = useCart();
  const { data: company } = useCompany();
  const { toast } = useToast();
  const [isBuying, setIsBuying] = React.useState(false);
  const categoryLabel = formatCategoryDisplayName(product.category);
  const imageSrcSet = getResponsiveImageSrcSet(product.image, [320, 480, 640, 768]);
  const acceptOrders = company?.settings?.acceptOrders !== false;
  const productPath = getProductPath(product);
  const productUrl = canonicalUrl(productPath);
  const productPrice = getNumericPriceValue(product.price);
  const productSku = getProductSku(product);

  const handleBuyNow = () => {
    if (isBuying) return;
    if (!acceptOrders) {
      toast({
        title: "Tienda cerrada temporalmente",
        description: "Por ahora no estamos recibiendo nuevos pedidos.",
        duration: 4000,
      });
      return;
    }

    setIsBuying(true);
    buyNow(product);
    window.location.assign("/checkout");
  };

  return (
    <article
      className="surface-card group flex h-full flex-col overflow-hidden border-[#DECDF0] transition-all duration-500"
      itemScope
      itemType="https://schema.org/Product"
    >
      <Link
        href={productPath}
        className="relative block aspect-square overflow-hidden border-b border-primary/20 bg-white"
      >
        <img
          itemProp="image"
          src={product.image}
          srcSet={imageSrcSet}
          alt={`${product.name} - Floreria DIFIORI Guayaquil`}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          sizes="(min-width: 1280px) 360px, (min-width: 640px) 44vw, 92vw"
          className="h-full w-full object-contain object-center"
        />

        {product.isBestSeller && (
          <div className="absolute top-6 left-6 z-10 rounded-full bg-accent px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-white shadow-lg">
            Mas Vendido
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col items-center p-6 text-center sm:p-7">
        <span className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3362]">
          {categoryLabel}
        </span>
        <h3 itemProp="name" className="mb-3 font-serif text-[2rem] font-bold leading-tight text-[#4A3362]">
          {product.name}
        </h3>
        <meta itemProp="description" content={product.description || `${product.name} con entrega a domicilio en Guayaquil.`} />
        <meta itemProp="sku" content={productSku} />
        <meta itemProp="mpn" content={productSku} />
        <meta itemProp="url" content={productUrl} />
        <div itemProp="brand" itemScope itemType="https://schema.org/Brand">
          <meta itemProp="name" content="DIFIORI" />
        </div>

        {/* <div className="flex flex-wrap justify-center gap-2 mb-6 opacity-60">
           {product.size && (
             <span className="rounded-full bg-muted px-3 py-1 text-[9px] font-bold uppercase tracking-wider">{product.size}</span>
           )}
        </div> */}

        <div className="mt-auto" itemProp="offers" itemScope itemType="https://schema.org/Offer">
          <meta itemProp="url" content={productUrl} />
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="price" content={productPrice} />
          <link itemProp="availability" href="https://schema.org/InStock" />
          <link itemProp="itemCondition" href="https://schema.org/NewCondition" />
          <p className="mb-7 text-3xl font-black text-foreground">{product.price}</p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button type="button" onClick={handleBuyNow} disabled={isBuying} className="ui-btn-primary w-full">
            {isBuying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingBag className="h-4 w-4" />
            )}
            {isBuying ? "Cargando..." : "Comprar Ahora"}
          </button>
          <a
            href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}?text=Hola!%20Me%20interesa%20el%20producto%20${encodeURIComponent(product.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn-secondary w-full"
          >
            <MessageSquare className="h-4 w-4" />
            Pedir por WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}
