export interface ProductLike {
  id: string | number;
  name: string;
  category?: string;
  isBestSeller?: boolean;
}

export interface CatalogProductCandidate extends ProductLike {
  description?: string;
  price?: string | number;
  image?: string | null;
}

export const BEST_SELLERS_CATEGORY_NAME = "Más Vendidos";
export const BEST_SELLERS_CATEGORY_SLUG = "mas-vendidos";

const MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ãº", "ú"],
  ["Ã", "Á"],
  ["Ã‰", "É"],
  ["Ã", "Í"],
  ["Ã“", "Ó"],
  ["Ãš", "Ú"],
  ["Ã±", "ñ"],
  ["Ã‘", "Ñ"],
  ["Â¿", "¿"],
  ["Â¡", "¡"],
  ["Â©", "©"],
];

const CATEGORY_LABELS: Record<string, string> = {
  "ramos-de-rosas": "Ramos de Rosas",
  "flores-mixtas": "Flores Mixtas",
  "desayunos-sorpresa": "Desayunos Sorpresa",
  "regalos-con-vino": "Regalos con Vino",
  cumpleanos: "Cumpleaños",
  "amor-y-aniversario": "Amor y Aniversario",
  [BEST_SELLERS_CATEGORY_SLUG]: BEST_SELLERS_CATEGORY_NAME,
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "ramos-de-rosas": "Ramos de rosas frescas con entrega a domicilio en Guayaquil para aniversarios, cumpleaños y ocasiones especiales.",
  "flores-mixtas": "Arreglos de flores mixtas con diseños elegantes y entrega a domicilio en Guayaquil.",
  "desayunos-sorpresa": "Desayunos sorpresa y regalos a domicilio en Guayaquil para cumpleaños, aniversarios y momentos especiales.",
  "regalos-con-vino": "Regalos con vino y arreglos florales para sorprender en Guayaquil con entrega a domicilio.",
  cumpleanos: "Arreglos florales y regalos de cumpleaños en Guayaquil con entrega rápida.",
  "amor-y-aniversario": "Flores y regalos para aniversarios y ocasiones románticas con entrega a domicilio en Guayaquil.",
  [BEST_SELLERS_CATEGORY_SLUG]: "Selección de arreglos florales y regalos más vendidos en Guayaquil.",
};

function repairMojibake(value: string) {
  return MOJIBAKE_REPLACEMENTS.reduce(
    (text, [broken, fixed]) => text.replaceAll(broken, fixed),
    value,
  );
}

export function normalizeDisplayText(value: string | null | undefined) {
  if (!value) return "";
  return repairMojibake(value).replace(/\s+/g, " ").trim();
}

function toReadableTitleCase(value: string) {
  const smallWords = new Set(["a", "al", "con", "de", "del", "en", "la", "las", "para", "por", "y"]);

  return value
    .toLocaleLowerCase("es")
    .split(" ")
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("es") + word.slice(1);
    })
    .join(" ");
}

export function formatCategoryDisplayName(name: string | null | undefined) {
  const normalized = normalizeDisplayText(name);
  if (!normalized) return "General";

  const knownLabel = CATEGORY_LABELS[getCategorySlug(normalized)];
  if (knownLabel) return knownLabel;

  return toReadableTitleCase(normalized);
}

export function slugify(value: string) {
  return normalizeDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCategorySlug(name: string) {
  if (normalizeDisplayText(name) === BEST_SELLERS_CATEGORY_NAME) return BEST_SELLERS_CATEGORY_SLUG;
  return slugify(name);
}

export function getCategoryPath(nameOrSlug: string) {
  const slug = nameOrSlug.includes("/") ? nameOrSlug.split("/").pop() || nameOrSlug : nameOrSlug;
  const normalized = normalizeDisplayText(slug) === BEST_SELLERS_CATEGORY_NAME ? BEST_SELLERS_CATEGORY_SLUG : slugify(slug);
  return `/categoria/${normalized}`;
}

export function getCategoryDescription(name: string) {
  const slug = getCategorySlug(name);
  return CATEGORY_DESCRIPTIONS[slug] || `Colección de ${normalizeDisplayText(name).toLocaleLowerCase("es")} con entrega a domicilio en Guayaquil.`;
}

export function findCategoryNameBySlug(categories: string[], slug: string) {
  if (slug === BEST_SELLERS_CATEGORY_SLUG) return BEST_SELLERS_CATEGORY_NAME;
  return categories.find((category) => getCategorySlug(category) === slug) || null;
}

export function getProductSlug(product: ProductLike) {
  return `${slugify(product.name)}-${product.id}`;
}

export function getProductPath(product: ProductLike) {
  return `/producto/${getProductSlug(product)}`;
}

export function getProductIdFromSlug(slug: string) {
  const segments = slug.split("-");
  return segments[segments.length - 1] || "";
}

function parsePrice(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getNumericPriceValue(price: string | number | null | undefined) {
  const parsed = parsePrice(price);
  return parsed > 0 ? parsed.toFixed(2) : "0.00";
}

export function getProductSku(product: ProductLike) {
  return `DIFIORI-${String(product.id).replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function isPublicCatalogProduct(product: CatalogProductCandidate) {
  const name = normalizeDisplayText(product.name);
  const description = normalizeDisplayText(product.description);
  const category = normalizeDisplayText(product.category);
  const slug = slugify(name);
  const price = parsePrice(product.price);

  const blockedNames = new Set(["uhoug-f", "hs-jjs"]);
  if (blockedNames.has(slug)) return false;

  const hasReadableName = name.length >= 8 && /[aeiouáéíóúñ]/i.test(name);
  const hasUsefulDescription = description.length >= 24;
  const hasPublicCategory = category.length > 2 && slugify(category) !== "general";
  const hasCatalogPrice = price >= 10;

  return hasReadableName && hasUsefulDescription && hasPublicCategory && hasCatalogPrice;
}
