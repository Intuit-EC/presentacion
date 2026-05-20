import { createContext, useContext, useEffect, type ReactNode } from "react";
import { DEFAULT_COMPANY, DEFAULT_SEO_IMAGE, absoluteUrl, canonicalUrl } from "@/lib/site";

type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

export interface SeoProps {
  title: string;
  description: string;
  keywords?: string;
  path?: string;
  robots?: string;
  image?: string;
  type?: string;
  schema?: JsonLd;
}

export interface SeoState {
  title: string;
  description: string;
  keywords?: string;
  path: string;
  robots: string;
  image: string;
  type: string;
  schema?: JsonLd;
}

export interface SeoManager {
  setState: (state: SeoState) => void;
  getState: () => SeoState;
}

export const DEFAULT_SEO_STATE: SeoState = {
  title: "Flores en Guayaquil | Floreria Guayaquil a Domicilio | DIFIORI",
  description:
    "Flores en Guayaquil y floreria Guayaquil con pedidos a domicilio. Compra ramos, arreglos florales y regalos con entrega en Guayaquil.",
  keywords: "flores en Guayaquil, floreria Guayaquil, flores a domicilio Guayaquil, pedidos de flores Guayaquil, arreglos florales Guayaquil",
  path: "/",
  robots: "index, follow",
  image: DEFAULT_SEO_IMAGE,
  type: "website",
};

const SeoContext = createContext<SeoManager | null>(null);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createSeoManager(initialState: SeoState = DEFAULT_SEO_STATE): SeoManager {
  let currentState = initialState;

  return {
    setState: (state) => {
      currentState = state;
    },
    getState: () => currentState,
  };
}

export function SeoProvider({
  children,
  manager,
}: {
  children: ReactNode;
  manager?: SeoManager;
}) {
  return <SeoContext.Provider value={manager || null}>{children}</SeoContext.Provider>;
}

export function buildSeoState({
  title,
  description,
  keywords,
  path = "/",
  robots = "index, follow",
  image = DEFAULT_SEO_IMAGE,
  type = "website",
  schema,
}: SeoProps): SeoState {
  return {
    title,
    description,
    keywords,
    path,
    robots,
    image,
    type,
    schema,
  };
}

export function renderSeoTags(state: SeoState) {
  const canonical = canonicalUrl(state.path);
  const imageUrl = absoluteUrl(state.image);
  const tags = [
    `<title>${escapeHtml(state.title)}</title>`,
    `<meta name="description" content="${escapeHtml(state.description)}" />`,
    state.keywords ? `<meta name="keywords" content="${escapeHtml(state.keywords)}" />` : "",
    `<meta name="robots" content="${escapeHtml(state.robots)}" />`,
    `<meta name="author" content="${escapeHtml(DEFAULT_COMPANY.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(state.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(state.description)}" />`,
    `<meta property="og:type" content="${escapeHtml(state.type)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(DEFAULT_COMPANY.name)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(state.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(state.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
  ].filter(Boolean);

  if (state.schema) {
    tags.push(
      `<script id="seo-json-ld" type="application/ld+json">${JSON.stringify(state.schema).replace(/</g, "\\u003c")}</script>`,
    );
  }

  return tags.join("\n");
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function removeMeta(attribute: "name" | "property", key: string) {
  document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)?.remove();
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

export function Seo({
  title,
  description,
  keywords,
  path = "/",
  robots = "index, follow",
  image = DEFAULT_SEO_IMAGE,
  type = "website",
  schema,
}: SeoProps) {
  const manager = useContext(SeoContext);
  const seoState = buildSeoState({
    title,
    description,
    keywords,
    path,
    robots,
    image,
    type,
    schema,
  });

  if (manager) {
    manager.setState(seoState);
  }

  useEffect(() => {
    const canonical = canonicalUrl(seoState.path);
    const imageUrl = absoluteUrl(seoState.image);

    document.title = seoState.title;
    document.documentElement.lang = "es";

    upsertMeta("name", "description", seoState.description);
    if (seoState.keywords) {
      upsertMeta("name", "keywords", seoState.keywords);
    } else {
      removeMeta("name", "keywords");
    }
    upsertMeta("name", "robots", seoState.robots);
    upsertMeta("name", "author", DEFAULT_COMPANY.name);
    upsertMeta("property", "og:title", seoState.title);
    upsertMeta("property", "og:description", seoState.description);
    upsertMeta("property", "og:type", seoState.type);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:site_name", DEFAULT_COMPANY.name);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seoState.title);
    upsertMeta("name", "twitter:description", seoState.description);
    upsertMeta("name", "twitter:image", imageUrl);
    upsertLink("canonical", canonical);

    const existingJsonLd = document.getElementById("seo-json-ld");

    if (seoState.schema) {
      const script = existingJsonLd || document.createElement("script");
      script.id = "seo-json-ld";
      script.setAttribute("type", "application/ld+json");
      script.textContent = JSON.stringify(seoState.schema);

      if (!existingJsonLd) {
        document.head.appendChild(script);
      }
    } else if (existingJsonLd) {
      existingJsonLd.remove();
    }
  }, [seoState]);

  return null;
}
