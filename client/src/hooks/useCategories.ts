import { useQuery } from "@tanstack/react-query";
import { resolveApiUrl } from "@/lib/api";
import { dedupeCategoriesBySlug } from "@shared/catalog";

const API_URL = "/api/external/products/categories";
export const categoriesQueryKey = ["categories"] as const;

export async function fetchCategories(baseUrl?: string): Promise<string[]> {
  try {
    const res = await fetch(resolveApiUrl(API_URL, baseUrl));
    if (!res.ok) throw new Error("Error al cargar categorias");

    const json = await res.json();
    if (json.status !== "success") throw new Error("Respuesta invalida del servidor");

    return dedupeCategoriesBySlug(json.data);
  } catch (error) {
    console.warn("Error fetching categories from API:", error);
    return [];
  }
}

export function useCategories(enabled = true) {
  return useQuery<string[], Error>({
    queryKey: categoriesQueryKey,
    queryFn: () => fetchCategories(),
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}
