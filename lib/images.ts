import fs from "fs";
import path from "path";
import type { Page } from "./pages";

export type ImageCategory = "hero" | "work" | "details" | "brand" | "placeholders";

export interface VisualMeta {
  id: string;
  label: string;
  icon: string;
  category: ImageCategory;
  gradientFrom: string;
  gradientTo: string;
  accent: string;
}

export interface PageVisual {
  src: string | null;
  meta: VisualMeta;
  alt: string;
}

export interface DetailVisuals {
  guarantee: PageVisual;
  callMaster: PageVisual;
}

const IMAGE_EXT_PATTERN = /\.(webp|jpe?g|png)$/i;

/**
 * Реальные файлы в public/images/ (URL всегда /images/{category}/{file}).
 * Если файла нет на диске — src будет null, VisualImage покажет CSS-placeholder.
 */
const CATEGORY_FILES: Record<"hero" | "work" | "details", readonly string[]> = {
  hero: ["111.webp", "1111.webp"],
  work: ["1.webp", "2.webp", "3.webp"],
  details: [],
};

const PAGE_THEMES = [
  { gradientFrom: "#0ea5e9", gradientTo: "#0369a1", accent: "#38bdf8" },
  { gradientFrom: "#6366f1", gradientTo: "#4338ca", accent: "#818cf8" },
  { gradientFrom: "#f97316", gradientTo: "#c2410c", accent: "#fb923c" },
  { gradientFrom: "#14b8a6", gradientTo: "#0f766e", accent: "#5eead4" },
  { gradientFrom: "#ec4899", gradientTo: "#be185d", accent: "#f472b6" },
  { gradientFrom: "#22c55e", gradientTo: "#15803d", accent: "#4ade80" },
  { gradientFrom: "#64748b", gradientTo: "#334155", accent: "#94a3b8" },
  { gradientFrom: "#1e3a5f", gradientTo: "#0f172a", accent: "#f97316" },
] as const;

interface CatalogItem {
  id: string;
  label: string;
  icon: string;
  category: ImageCategory;
}

const HERO_CATALOG: CatalogItem[] = [
  { id: "hero-111", label: "Мастер с инструментом", icon: "🛠️", category: "hero" },
  { id: "hero-1111", label: "Мастер в квартире", icon: "🏠", category: "hero" },
];

const WORK_CATALOG: CatalogItem[] = [
  { id: "work-1", label: "Фото работ 1", icon: "🔧", category: "work" },
  { id: "work-2", label: "Фото работ 2", icon: "🚿", category: "work" },
  { id: "work-3", label: "Фото работ 3", icon: "🍳", category: "work" },
];

const DETAILS_CATALOG: CatalogItem[] = [
  { id: "guarantee", label: "Гарантия", icon: "🛡️", category: "details" },
  { id: "call", label: "Звонок мастеру", icon: "📞", category: "details" },
];

const BRAND_CATALOG: CatalogItem[] = [
  { id: "logo-promaster", label: "ПроМастер", icon: "⭐", category: "brand" },
];

const poolCache = new Map<ImageCategory, string[]>();

function isImageFilename(name: string): boolean {
  if (!name || name.startsWith(".")) return false;
  if (name.includes(".webp.webp") || name.includes(".png.png")) return false;
  return IMAGE_EXT_PATTERN.test(name);
}

function numericBasename(name: string): number {
  const match = path.basename(name).match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function sortImagePaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const na = numericBasename(a);
    const nb = numericBasename(b);
    if (na !== nb) return na - nb;
    return a.localeCompare(b, "en");
  });
}

export function getSafeImage(relativePath: string): string | null {
  try {
    const normalized = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    if (!normalized.startsWith("/images/")) return null;

    const diskPath = path.join(process.cwd(), "public", normalized.replace(/^\//, ""));

    if (!fs.existsSync(diskPath)) return null;

    const stat = fs.statSync(diskPath);
    if (!stat.isFile() || stat.size <= 0) return null;

    return normalized;
  } catch {
    return null;
  }
}

function scanCategoryImages(category: ImageCategory): string[] {
  const pool: string[] = [];

  try {
    const dir = path.join(process.cwd(), "public", "images", category);
    if (!fs.existsSync(dir)) return pool;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !isImageFilename(entry.name)) continue;

      const src = getSafeImage(`/images/${category}/${entry.name}`);
      if (src) pool.push(src);
    }
  } catch {
    // ignore
  }

  return sortImagePaths(pool);
}

function pathsFromKnownList(category: "hero" | "work" | "details"): string[] {
  return CATEGORY_FILES[category]
    .map((filename) => getSafeImage(`/images/${category}/${filename}`))
    .filter((src): src is string => Boolean(src));
}

function listCategoryImages(category: ImageCategory): string[] {
  if (poolCache.has(category)) {
    return poolCache.get(category)!;
  }

  let pool: string[] = [];

  if (category === "hero" || category === "work" || category === "details") {
    pool = pathsFromKnownList(category);
    if (pool.length === 0) {
      pool = scanCategoryImages(category);
    }
  } else {
    pool = scanCategoryImages(category);
  }

  poolCache.set(category, pool);
  return pool;
}

export function getVisualSeed(page: Pick<Page, "slug">): number {
  const slug = page.slug || "default";
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getPageTheme(page: Page) {
  return PAGE_THEMES[getVisualSeed(page) % PAGE_THEMES.length];
}

function pickPoolImage(category: ImageCategory, seed: number, offset: number): string | null {
  const pool = listCategoryImages(category);
  if (pool.length === 0) return null;
  return pool[(seed + offset) % pool.length];
}

function toVisualMeta(item: CatalogItem, page: Page): VisualMeta {
  const theme = getPageTheme(page);
  return {
    id: item.id,
    label: item.label,
    icon: item.icon,
    category: item.category,
    ...theme,
  };
}

function toPageVisual(
  item: CatalogItem,
  page: Page,
  altSuffix: string,
  src: string | null
): PageVisual {
  const service = page.service || "Услуга";
  const cityPrep = page.cityPrepositional || page.city || "";
  return {
    src,
    meta: toVisualMeta(item, page),
    alt: `${item.label} — ${service} в ${cityPrep}. ${altSuffix}`.trim(),
  };
}

function findCatalogItem(catalog: CatalogItem[], id: string): CatalogItem {
  return catalog.find((item) => item.id === id) ?? catalog[0];
}

export function getHeroVisual(page: Page): PageVisual {
  try {
    const seed = getVisualSeed(page);
    const item = HERO_CATALOG[seed % HERO_CATALOG.length];
    const src = pickPoolImage("hero", seed, 0);
    return toPageVisual(item, page, "Выезд мастера на дом", src);
  } catch {
    const item = HERO_CATALOG[0];
    return {
      src: pickPoolImage("hero", 0, 0),
      meta: toVisualMeta(item, page),
      alt: `${page.service || "Услуга"} — выезд мастера`,
    };
  }
}

export function getWorkGallery(page: Page): PageVisual[] {
  try {
    const seed = getVisualSeed(page);
    const pool = listCategoryImages("work");
    const slots = pool.length > 0 ? pool.length : WORK_CATALOG.length;

    return Array.from({ length: slots }, (_, index) => {
      const item = WORK_CATALOG[index % WORK_CATALOG.length];
      const src = pool.length > 0 ? pool[(seed + index) % pool.length] : null;
      return toPageVisual(item, page, `Фото работ ${index + 1}`, src);
    });
  } catch {
    return [];
  }
}

export function getDetailVisuals(page: Page): DetailVisuals {
  try {
    const pool = listCategoryImages("details");

    return {
      guarantee: toPageVisual(
        findCatalogItem(DETAILS_CATALOG, "guarantee"),
        page,
        "Гарантия на работы",
        pool[0] ?? null
      ),
      callMaster: toPageVisual(
        findCatalogItem(DETAILS_CATALOG, "call"),
        page,
        "Как вызвать мастера",
        pool[1] ?? null
      ),
    };
  } catch {
    const item = DETAILS_CATALOG[0];
    const empty = { src: null, meta: toVisualMeta(item, page), alt: item.label };
    return { guarantee: empty, callMaster: empty };
  }
}

export function getBrandAssets(): PageVisual[] {
  try {
    const pool = listCategoryImages("brand");

    return BRAND_CATALOG.map((item, index) => {
      const meta: VisualMeta = {
        ...item,
        gradientFrom: "#1e3a5f",
        gradientTo: "#0f172a",
        accent: "#f97316",
      };
      return {
        src: pool[index] ?? pool[0] ?? null,
        meta,
        alt: item.label,
      };
    });
  } catch {
    return [];
  }
}
