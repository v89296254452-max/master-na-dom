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

const IMAGE_EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png"] as const;
const IMAGE_EXT_PATTERN = /\.(webp|jpe?g|png)$/i;

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
  { id: "master-tools", label: "Мастер с инструментом", icon: "🛠️", category: "hero" },
  { id: "master-apartment", label: "Мастер в квартире", icon: "🏠", category: "hero" },
  { id: "repair-process", label: "Процесс ремонта", icon: "⚙️", category: "hero" },
  { id: "universal-specialist", label: "Универсальный специалист", icon: "👷", category: "hero" },
];

const WORK_CATALOG: CatalogItem[] = [
  { id: "tools", label: "Инструменты", icon: "🔧", category: "work" },
  { id: "bathroom", label: "Ванная", icon: "🚿", category: "work" },
  { id: "kitchen", label: "Кухня", icon: "🍳", category: "work" },
  { id: "appliances", label: "Техника", icon: "📦", category: "work" },
  { id: "electrician", label: "Электрика", icon: "⚡", category: "work" },
  { id: "hands", label: "Рабочие руки", icon: "🤲", category: "work" },
  { id: "repair-work", label: "Процесс ремонта", icon: "🔩", category: "work" },
];

const DETAILS_CATALOG: CatalogItem[] = [
  { id: "guarantee", label: "Гарантия", icon: "🛡️", category: "details" },
  { id: "call", label: "Звонок мастеру", icon: "📞", category: "details" },
  { id: "checklist", label: "Чеклист", icon: "✅", category: "details" },
  { id: "consultation", label: "Консультация", icon: "💬", category: "details" },
  { id: "diagnostics", label: "Диагностика", icon: "🔍", category: "details" },
];

const BRAND_CATALOG: CatalogItem[] = [
  { id: "logo-promaster", label: "ПроМастер", icon: "⭐", category: "brand" },
  { id: "badge-trust", label: "Надёжный сервис", icon: "🏅", category: "brand" },
];

const poolCache = new Map<ImageCategory, string[]>();
const catalogIndexCache = new Map<ImageCategory, Map<string, string>>();

function isImageFilename(name: string): boolean {
  if (!name || name.startsWith(".")) return false;
  if (name.includes(".webp.webp") || name.includes(".png.png")) return false;
  return IMAGE_EXT_PATTERN.test(name);
}

function listCategoryImages(category: ImageCategory): string[] {
  if (poolCache.has(category)) {
    return poolCache.get(category)!;
  }

  const pool: string[] = [];

  try {
    const dir = path.join(process.cwd(), "public", "images", category);
    if (!fs.existsSync(dir)) {
      poolCache.set(category, pool);
      return pool;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!isImageFilename(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      try {
        if (fs.statSync(fullPath).size <= 0) continue;
      } catch {
        continue;
      }

      pool.push(`/images/${category}/${entry.name}`);
    }

    pool.sort((a, b) => a.localeCompare(b, "en"));
  } catch {
    // ignore
  }

  poolCache.set(category, pool);
  return pool;
}

function catalogIndex(category: ImageCategory): Map<string, string> {
  if (catalogIndexCache.has(category)) {
    return catalogIndexCache.get(category)!;
  }

  const index = new Map<string, string>();
  for (const filePath of listCategoryImages(category)) {
    const basename = path.basename(filePath);
    index.set(basename.toLowerCase(), basename);
  }

  catalogIndexCache.set(category, index);
  return index;
}

export function getVisualSeed(page: Pick<Page, "slug">): number {
  const slug = page.slug || "default";
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getSafeImage(relativePath: string): string | null {
  try {
    const normalized = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    const diskPath = path.join(process.cwd(), "public", normalized.replace(/^\//, ""));

    if (!fs.existsSync(diskPath)) return null;

    const stat = fs.statSync(diskPath);
    if (!stat.isFile() || stat.size <= 0) return null;

    return normalized;
  } catch {
    return null;
  }
}

function getPageTheme(page: Page) {
  return PAGE_THEMES[getVisualSeed(page) % PAGE_THEMES.length];
}

function resolveCatalogImage(category: ImageCategory, id: string): string | null {
  const index = catalogIndex(category);

  for (const ext of IMAGE_EXTENSIONS) {
    const filename = index.get(`${id}${ext}`.toLowerCase());
    if (filename) {
      const src = `/images/${category}/${filename}`;
      return getSafeImage(src);
    }
  }

  const placeholderIndex = catalogIndex("placeholders");
  for (const ext of IMAGE_EXTENSIONS) {
    const filename = placeholderIndex.get(`${id}${ext}`.toLowerCase());
    if (filename) {
      const src = `/images/placeholders/${filename}`;
      return getSafeImage(src);
    }
  }

  return null;
}

function resolvePoolImage(category: ImageCategory, seed: number, salt: number): string | null {
  const pool = listCategoryImages(category);
  if (pool.length === 0) return null;

  const index = (seed + salt) % pool.length;
  const candidate = pool[index];
  return getSafeImage(candidate);
}

function resolveImage(
  category: ImageCategory,
  catalogId: string,
  page: Pick<Page, "slug">,
  salt: number
): string | null {
  const byId = resolveCatalogImage(category, catalogId);
  if (byId) return byId;

  return resolvePoolImage(category, getVisualSeed(page), salt);
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
  salt: number
): PageVisual {
  const meta = toVisualMeta(item, page);
  const service = page.service || "Услуга";
  const cityPrep = page.cityPrepositional || page.city || "";
  return {
    src: resolveImage(item.category, item.id, page, salt),
    meta,
    alt: `${item.label} — ${service} в ${cityPrep}. ${altSuffix}`.trim(),
  };
}

function pickCatalogItems(
  catalog: CatalogItem[],
  seed: number,
  count: number,
  salt = 0
): CatalogItem[] {
  const picked: CatalogItem[] = [];
  const used = new Set<string>();

  for (let i = 0; i < catalog.length && picked.length < count; i++) {
    const item = catalog[(seed + salt + i * 5) % catalog.length];
    if (!used.has(item.id)) {
      used.add(item.id);
      picked.push(item);
    }
  }

  return picked;
}

function findCatalogItem(catalog: CatalogItem[], id: string): CatalogItem {
  return catalog.find((item) => item.id === id) ?? catalog[0];
}

function fallbackHero(page: Page): PageVisual {
  const item = HERO_CATALOG[0];
  return {
    src: resolvePoolImage("hero", getVisualSeed(page), 0),
    meta: toVisualMeta(item, page),
    alt: `${page.service || "Услуга"} — выезд мастера`,
  };
}

export function getHeroVisual(page: Page): PageVisual {
  try {
    const seed = getVisualSeed(page);
    const item = pickCatalogItems(HERO_CATALOG, seed, 1, 0)[0];
    return toPageVisual(item, page, "Выезд мастера на дом", 0);
  } catch {
    return fallbackHero(page);
  }
}

export function getWorkGallery(page: Page): PageVisual[] {
  try {
    const seed = getVisualSeed(page);
    return pickCatalogItems(WORK_CATALOG, seed, 6, 11).map((item, index) =>
      toPageVisual(item, page, `Фото работ ${index + 1}`, 11 + index * 3)
    );
  } catch {
    return [];
  }
}

export function getDetailVisuals(page: Page): DetailVisuals {
  try {
    return {
      guarantee: toPageVisual(
        findCatalogItem(DETAILS_CATALOG, "guarantee"),
        page,
        "Гарантия на работы",
        101
      ),
      callMaster: toPageVisual(
        findCatalogItem(DETAILS_CATALOG, "call"),
        page,
        "Как вызвать мастера",
        102
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
    return BRAND_CATALOG.map((item, index) => {
      const meta: VisualMeta = {
        ...item,
        gradientFrom: "#1e3a5f",
        gradientTo: "#0f172a",
        accent: "#f97316",
      };
      return {
        src: resolveImage("brand", item.id, { slug: "brand" }, index),
        meta,
        alt: item.label,
      };
    });
  } catch {
    return [];
  }
}
