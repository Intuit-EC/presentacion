import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { DEFAULT_COMPANY, DEFAULT_SEO_IMAGE, absoluteUrl, canonicalUrl } from "@/lib/site";

type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

export interface SeoProps {
  title: string;
  description: string;
  keywords?: string;
  path?: string;
  robots?: string;
  image?: string;
  imageAlt?: string;
  type?: string;
  locale?: string;
  schema?: JsonLd;
}

export interface SeoState {
  title: string;
  description: string;
  keywords?: string;
  path: string;
  robots: string;
  image: string;
  imageAlt: string;
  type: string;
  locale: string;
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
  imageAlt: "Arreglos florales DIFIORI en Guayaquil",
  type: "website",
  locale: "es_EC",
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
  imageAlt,
  type = "website",
  locale = "es_EC",
  schema,
}: SeoProps): SeoState {
  return {
    title,
    description,
    keywords,
    path,
    robots,
    image,
    imageAlt: imageAlt || title,
    type,
    locale,
    schema,
  };
}

export function renderSeoTags(state: SeoState) {
  const canonical = canonicalUrl(state.path);
  const imageUrl = absoluteUrl(state.image);
  const escapedTitle = escapeHtml(state.title);
  const escapedDescription = escapeHtml(state.description);
  const escapedCanonical = escapeHtml(canonical);
  const escapedImageUrl = escapeHtml(imageUrl);
  const escapedImageAlt = escapeHtml(state.imageAlt);
  const tags = [
    `<title>${escapedTitle}</title>`,
    `<meta name="description" content="${escapedDescription}" />`,
    state.keywords ? `<meta name="keywords" content="${escapeHtml(state.keywords)}" />` : "",
    `<meta name="robots" content="${escapeHtml(state.robots)}" />`,
    `<meta name="author" content="${escapeHtml(DEFAULT_COMPANY.name)}" />`,
    `<meta name="application-name" content="${escapeHtml(DEFAULT_COMPANY.name)}" />`,
    `<meta name="format-detection" content="telephone=no" />`,
    `<meta name="referrer" content="strict-origin-when-cross-origin" />`,
    `<meta name="theme-color" content="#ffffff" />`,
    `<meta itemprop="name" content="${escapedTitle}" />`,
    `<meta itemprop="description" content="${escapedDescription}" />`,
    `<meta itemprop="image" content="${escapedImageUrl}" />`,
    `<meta property="og:title" content="${escapedTitle}" />`,
    `<meta property="og:description" content="${escapedDescription}" />`,
    `<meta property="og:type" content="${escapeHtml(state.type)}" />`,
    `<meta property="og:url" content="${escapedCanonical}" />`,
    `<meta property="og:site_name" content="${escapeHtml(DEFAULT_COMPANY.name)}" />`,
    `<meta property="og:locale" content="${escapeHtml(state.locale)}" />`,
    `<meta property="og:image" content="${escapedImageUrl}" />`,
    `<meta property="og:image:secure_url" content="${escapedImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapedImageAlt}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapedTitle}" />`,
    `<meta name="twitter:description" content="${escapedDescription}" />`,
    `<meta name="twitter:image" content="${escapedImageUrl}" />`,
    `<meta name="twitter:image:alt" content="${escapedImageAlt}" />`,
    `<link rel="canonical" href="${escapedCanonical}" />`,
    `<link rel="alternate" href="${escapedCanonical}" hreflang="es-EC" />`,
    `<link rel="alternate" href="${escapedCanonical}" hreflang="x-default" />`,
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
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]:not([hreflang])`);

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

function upsertAlternateLink(hreflang: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${hreflang}"]`);

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "alternate");
    element.setAttribute("hreflang", hreflang);
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
  imageAlt,
  type = "website",
  locale = "es_EC",
  schema,
}: SeoProps) {
  const manager = useContext(SeoContext);
  const seoState = useMemo(
    () =>
      buildSeoState({
        title,
        description,
        keywords,
        path,
        robots,
        image,
        imageAlt,
        type,
        locale,
        schema,
      }),
    [title, description, keywords, path, robots, image, imageAlt, type, locale, schema],
  );

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
    upsertMeta("name", "application-name", DEFAULT_COMPANY.name);
    upsertMeta("name", "format-detection", "telephone=no");
    upsertMeta("name", "referrer", "strict-origin-when-cross-origin");
    upsertMeta("name", "theme-color", "#ffffff");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("property", "og:title", seoState.title);
    upsertMeta("property", "og:description", seoState.description);
    upsertMeta("property", "og:type", seoState.type);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:site_name", DEFAULT_COMPANY.name);
    upsertMeta("property", "og:locale", seoState.locale);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("property", "og:image:secure_url", imageUrl);
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:image:alt", seoState.imageAlt);
    upsertMeta("name", "twitter:image:alt", seoState.imageAlt);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seoState.title);
    upsertMeta("name", "twitter:description", seoState.description);
    upsertMeta("name", "twitter:image", imageUrl);
    upsertLink("canonical", canonical);
    upsertAlternateLink("es-EC", canonical);
    upsertAlternateLink("x-default", canonical);

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
