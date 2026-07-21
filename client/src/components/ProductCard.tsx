import React from "react";
import type { Product } from "@/data/mock";
import { Link } from "wouter";
import { Clock3, Loader2, MessageSquare, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { trackFacebookEvent } from "@/lib/facebook-pixel";
import { getResponsiveImageSrcSet } from "@/lib/media";
import { DEFAULT_COMPANY, canonicalUrl } from "@/lib/site";
import { formatCategoryDisplayName, getNumericPriceValue, getProductPath, getProductSku } from "@shared/catalog";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
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
    trackFacebookEvent("AddToCart", {
      content_ids: [productSku],
      content_name: product.name,
      content_type: "product",
      currency: "USD",
      value: productPrice,
    });
    trackFacebookEvent("InitiateCheckout", {
      content_ids: [productSku],
      content_name: product.name,
      content_type: "product",
      currency: "USD",
      num_items: 1,
      value: productPrice,
    });
    buyNow(product);
    window.location.assign("/checkout");
  };

  return (
    <article
      className="surface-card group flex h-full flex-col overflow-hidden border-[#DECDF0] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(74,51,98,0.14)]"
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
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          width={720}
          height={720}
          sizes="(min-width: 1280px) 360px, (min-width: 640px) 44vw, 92vw"
          className="h-full w-full object-contain object-center"
        />

        {product.isBestSeller && (
          <div className="absolute top-6 left-6 z-10 rounded-full bg-accent px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-white shadow-lg">
            Mas Vendido
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <span className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#4A3362]">
          {categoryLabel}
        </span>
        <Link href={productPath} className="group/title mb-3 block">
          <h3 itemProp="name" className="font-serif text-[1.65rem] font-bold leading-tight text-[#4A3362] transition-colors group-hover/title:text-accent">
            {product.name}
          </h3>
        </Link>
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

        <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground/75">
          <Clock3 className="h-4 w-4 text-accent" />
          Entrega estimada: {product.deliveryTime || "a coordinar"}
        </div>

        <div className="mt-auto flex w-full items-end justify-between gap-4 border-t border-primary/30 pt-4" itemProp="offers" itemScope itemType="https://schema.org/Offer">
          <meta itemProp="url" content={productUrl} />
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="price" content={productPrice} />
          <link itemProp="availability" href="https://schema.org/InStock" />
          <link itemProp="itemCondition" href="https://schema.org/NewCondition" />
          <div>
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/55">Precio</span>
            <p className="text-3xl font-black text-foreground">{product.price}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">Disponible</span>
        </div>

        <div className="mt-5 flex w-full flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-foreground/65">
            <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-primary/15 bg-white px-2.5 py-2 shadow-[0_8px_22px_rgba(74,51,98,0.06)]">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Pago seguro
            </span>
            <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-primary/15 bg-white px-2.5 py-2 shadow-[0_8px_22px_rgba(74,51,98,0.06)]">
              <Truck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Guayaquil
            </span>
          </div>
          <p className="rounded-2xl bg-[#FBF7FD] px-3 py-2 text-center text-[11px] font-bold leading-relaxed text-[#4A3362]/80">
            Confirmamos tu pedido por WhatsApp y lo coordinamos con entrega en Guayaquil.
          </p>
          <button type="button" onClick={handleBuyNow} disabled={isBuying} className="ui-btn-primary w-full">
            {isBuying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingBag className="h-4 w-4" />
            )}
            {isBuying ? "Cargando..." : "Comprar ahora"}
          </button>
          <a
            href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}?text=Hola!%20Me%20interesa%20el%20producto%20${encodeURIComponent(product.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn-secondary w-full"
          >
            <MessageSquare className="h-4 w-4" />
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}
