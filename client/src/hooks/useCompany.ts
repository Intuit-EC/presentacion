import { useQuery } from "@tanstack/react-query";
import { resolveApiUrl } from "@/lib/api";
import { DEFAULT_COMPANY } from "@/lib/site";

interface CompanyInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  logo?: string;
  settings?: any;
}

const API_URL = "/api/external/company";
export const companyQueryKey = ["company-info"] as const;
export type { CompanyInfo };

export async function fetchCompany(baseUrl?: string): Promise<CompanyInfo> {
  try {
    const res = await fetch(resolveApiUrl(API_URL, baseUrl));
    if (!res.ok) throw new Error("Error al cargar informacion de la empresa");
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.warn("Error fetching company info from API, using fallback data:", error);
    return {
      name: DEFAULT_COMPANY.name,
      email: DEFAULT_COMPANY.email,
      phone: DEFAULT_COMPANY.phoneDisplay,
      address: `${DEFAULT_COMPANY.city}, ${DEFAULT_COMPANY.country}`,
    };
  }
}

export function useCompany(enabled = true) {
  return useQuery<CompanyInfo, Error>({
    queryKey: companyQueryKey,
    queryFn: () => fetchCompany(),
    enabled,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}
