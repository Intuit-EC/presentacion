import { useQuery } from "@tanstack/react-query";
import type { Product } from "../data/mock";
import { resolveApiUrl } from "@/lib/api";
import { toPublicImageUrl } from "@/lib/media";
import { isPublicCatalogProduct } from "@shared/catalog";

const API_URL = "/api/external/products";

export interface ProductsQueryOptions {
  category?: string;
  featured?: boolean;
  limit?: number;
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
  ] as const;
};

function getImageUrl(imagePath: string | null | undefined): string {
  const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%239ca3af'%3ESin imagen disponible%3C/text%3E%3C/svg%3E";

  if (!imagePath || imagePath.trim() === "" || imagePath === "/assets/product1.png") {
    return PLACEHOLDER;
  }

  return toPublicImageUrl(imagePath) || PLACEHOLDER;
}

export async function fetchProducts(
  options: string | ProductsQueryOptions = {},
  baseUrl?: string,
): Promise<Product[]> {
  try {
    const normalized = normalizeProductOptions(options);
    const params = new URLSearchParams();

    if (normalized.category && normalized.category !== "all") params.set("category", normalized.category);
    if (normalized.featured) params.set("featured", "true");
    if (normalized.limit && normalized.limit > 0) params.set("limit", String(normalized.limit));

    const query = params.toString();
    const endpoint = query ? `${API_URL}?${query}` : API_URL;
    const res = await fetch(resolveApiUrl(endpoint, baseUrl));
    if (!res.ok) throw new Error("Error al cargar productos");

    const json = await res.json();
    if (json.status !== "success") throw new Error("Respuesta invalida del servidor");

    return json.data
      .map((p: any): Product => ({
        id: String(p.id),
        name: p.name,
        description: p.description || "",
        category: p.category || "General",
        price: p.price || "$0.00",
        image: getImageUrl(p.image),
        isBestSeller: p.isBestSeller || false,
        stock: p.stock ?? 99,
        deliveryTime: p.deliveryTime || "",
        size: p.size || "",
        includes: p.includes || p.description || "",
      }))
      .filter(isPublicCatalogProduct);
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
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}

export function useFeaturedProducts() {
  return useQuery<Product[], Error>({
    queryKey: productsQueryKey({ featured: true }),
    queryFn: () => fetchProducts({ featured: true }),
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}
