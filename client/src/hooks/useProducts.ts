import { useQuery } from "@tanstack/react-query";
import type { Product } from "../data/mock";
import { resolveApiUrl } from "@/lib/api";
import { toPublicImageUrl } from "@/lib/media";
import { areSameCategory, isPublicCatalogProduct } from "@shared/catalog";

const API_URL = "/api/external/products";

export interface ProductsQueryOptions {
  category?: string;
  featured?: boolean;
  limit?: number;
  summary?: boolean;
  search?: string;
  enabled?: boolean;
}

function normalizeProductOptions(options: string | ProductsQueryOptions = {}) {
  return typeof options === "string" ? { category: options } : options;
}

export const productsQueryKey = (options: string | ProductsQueryOptions = {}) => {
  const normalized = normalizeProductOptions(options);
  return [
    "products",
    normalized.category || "all",
    normalized.featured ? "featured" : "all",
    normalized.limit || "all",
    normalized.summary ? "summary" : "full",
    normalized.search || "",
  ] as const;
};

function getImageUrl(imagePath: string | null | undefined): string {
  const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%239ca3af'%3ESin imagen disponible%3C/text%3E%3C/svg%3E";

  if (!imagePath || imagePath.trim() === "" || imagePath === "/assets/product1.png") {
    return PLACEHOLDER;
  }

  return toPublicImageUrl(imagePath) || PLACEHOLDER;
}

function normalizePublicProductText(value: unknown) {
  return String(value || "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Orden estable del catalogo: primero lo que mas se vende. Antes se barajaba al
 * azar en cada carga, asi que nadie veia dos veces la misma vitrina, los mejores
 * productos podian quedar al final y el HTML del servidor no coincidia con el
 * del navegador.
 */
function sortProductsForStorefront(products: Product[]) {
  return [...products].sort((left, right) => {
    if (left.isBestSeller !== right.isBestSeller) {
      return left.isBestSeller ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "es");
  });
}

export async function fetchProducts(
  options: string | ProductsQueryOptions = {},
  baseUrl?: string,
): Promise<Product[]> {
  try {
    const normalized = normalizeProductOptions(options);
    const params = new URLSearchParams();

    if (normalized.featured) params.set("featured", "true");
    if (normalized.limit) params.set("limit", String(normalized.limit));
    if (normalized.summary) params.set("summary", "true");
    if (normalized.search) params.set("search", normalized.search);

    const query = params.toString();
    const endpoint = query ? `${API_URL}?${query}` : API_URL;
    const res = await fetch(resolveApiUrl(endpoint, baseUrl));
    if (!res.ok) throw new Error("Error al cargar productos");

    const json = await res.json();
    if (json.status !== "success") throw new Error("Respuesta invalida del servidor");

    const products = json.data
      .map((p: any): Product => {
        const fullDescription = normalizePublicProductText(p.description);

        return {
          id: String(p.id),
          name: normalizePublicProductText(p.name),
          description: normalized.summary ? fullDescription.slice(0, 220) : fullDescription,
          category: p.category || "General",
          price: p.price || "$0.00",
          image: getImageUrl(p.image),
          isBestSeller: p.isBestSeller || false,
          stock: p.stock ?? 99,
          deliveryTime: p.deliveryTime || "",
          size: normalizePublicProductText(p.size),
          includes: normalized.summary ? "" : normalizePublicProductText(p.includes || p.description),
        };
      })
      .filter(isPublicCatalogProduct)
      .filter((product: Product) => {
        if (!normalized.category || normalized.category === "all") return true;
        return areSameCategory(product.category, normalized.category);
      });

    const visibleProducts = sortProductsForStorefront(products);

    return normalized.limit && normalized.limit > 0
      ? visibleProducts.slice(0, normalized.limit)
      : visibleProducts;
  } catch (error) {
    console.warn("Error fetching products from API:", error);
    return [];
  }
}

export function useProducts(options?: string | ProductsQueryOptions) {
  const normalized = normalizeProductOptions(options);

  return useQuery<Product[], Error>({
    queryKey: productsQueryKey(options),
    queryFn: () => fetchProducts(options),
    enabled: normalized.enabled ?? true,
    // El backend ya cachea el catalogo 60s; volver a pedir 165KB de productos en
    // cada navegacion solo hacia mas lenta la tienda.
    staleTime: 60_000,
    retry: 1,
  });
}

export function useFeaturedProducts() {
  return useQuery<Product[], Error>({
    queryKey: productsQueryKey({ featured: true }),
    queryFn: () => fetchProducts({ featured: true }),
    // El backend ya cachea el catalogo 60s; volver a pedir 165KB de productos en
    // cada navegacion solo hacia mas lenta la tienda.
    staleTime: 60_000,
    retry: 1,
  });
}
