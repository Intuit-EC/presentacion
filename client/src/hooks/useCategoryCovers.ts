import { useQuery } from "@tanstack/react-query";
import { resolveApiUrl } from "@/lib/api";
import { toPublicImageUrl } from "@/lib/media";
import { getCategorySlug } from "@shared/catalog";

const API_URL = "/api/external/products/category-covers";
export const categoryCoversQueryKey = ["category-covers"] as const;

interface CategoryCover {
  category: string;
  image: string;
}

export async function fetchCategoryCovers(baseUrl?: string): Promise<Map<string, string>> {
  try {
    const res = await fetch(resolveApiUrl(API_URL, baseUrl));
    if (!res.ok) throw new Error("Error al cargar portadas de categorias");

    const json = await res.json();
    if (json.status !== "success") throw new Error("Respuesta invalida del servidor");

    const covers = new Map<string, string>();
    for (const item of json.data as CategoryCover[]) {
      const slug = getCategorySlug(item.category);
      const image = toPublicImageUrl(item.image);
      if (slug && image) covers.set(slug, image);
    }

    return covers;
  } catch (error) {
    console.warn("Error fetching category covers from API:", error);
    return new Map();
  }
}

export function useCategoryCovers(enabled = true) {
  return useQuery<Map<string, string>, Error>({
    queryKey: categoryCoversQueryKey,
    queryFn: () => fetchCategoryCovers(),
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}
