import fs from "fs";
import path from "path";
import { getContentIndex } from "./content-cache";

const ROOT = process.cwd();

function readCsv(file: string): Record<string, string>[] {
  try {
    const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n").filter(Boolean);
    const header = lines[0].split(",");
    return lines.slice(1).map((line) => {
      const cols = line.split(",");
      const row: Record<string, string> = {};
      header.forEach((h, i) => { row[h] = cols[i] ?? ""; });
      return row;
    });
  } catch {
    return [];
  }
}

export type PageType = "geo" | "brand" | "problem";

/** Метаданные страницы БЕЗ статуса индексации (indexed добавляется на момент запроса). */
interface PageMeta {
  type: PageType;
  slug: string;
  title: string;
  service: string;
  city: string;
  extra: string; // бренд или проблема
  url: string;
}

export interface BrowsedPage extends PageMeta {
  indexed: boolean;
}

export interface PagesQuery {
  type?: PageType;
  q?: string; // поиск по городу/услуге/бренду/проблеме
  indexed?: "yes" | "no";
  limit?: number;
}

// Кэш ТОЛЬКО списка страниц из CSV (стабилен, лёгкий, без 225 МБ ИИ-контента).
// Статус indexed считается динамически из общего content-index на каждый запрос.
type PagesCache = { geo: PageMeta[]; brand: PageMeta[]; problem: PageMeta[] };
let cache: PagesCache | null = null;

function buildPagesList(): PagesCache {
  const geo: PageMeta[] = readCsv("data/pages.csv").map((r) => ({
    type: "geo",
    slug: r.slug,
    title: r.h1 || `${r.service} в ${r.cityPrepositional || r.city}`,
    service: r.service,
    city: r.city,
    extra: "",
    url: `/${r.slug}`,
  }));

  const brand: PageMeta[] = readCsv("data/brand-pages.csv").map((r) => ({
    type: "brand",
    slug: r.slug,
    title: `${r.service} ${r.brand} в ${r.cityDat || r.city}`,
    service: r.service,
    city: r.city,
    extra: r.brand,
    url: `/${r.slug}`,
  }));

  const problem: PageMeta[] = readCsv("data/problems-cluster.csv").map((r) => ({
    type: "problem",
    slug: r.slug,
    title: r.h1 || `${r.problem} в ${r.cityDat || r.city}`,
    service: r.service,
    city: r.city,
    extra: r.problem,
    url: `/problem-service/${r.slug}`,
  }));

  return { geo, brand, problem };
}

function getCache(): PagesCache {
  if (!cache) cache = buildPagesList();
  return cache;
}

export async function searchPages(q: PagesQuery): Promise<{ items: BrowsedPage[]; total: number }> {
  const all = getCache();
  const { indexedSlugs } = await getContentIndex();
  const pools: PageMeta[] = q.type ? all[q.type] : [...all.geo, ...all.brand, ...all.problem];

  const needle = (q.q || "").trim().toLowerCase();
  let filtered = pools;
  if (needle) {
    filtered = filtered.filter(
      (p) =>
        p.city.toLowerCase().includes(needle) ||
        p.service.toLowerCase().includes(needle) ||
        p.extra.toLowerCase().includes(needle) ||
        p.slug.toLowerCase().includes(needle)
    );
  }
  if (q.indexed === "yes") filtered = filtered.filter((p) => indexedSlugs.has(p.slug));
  if (q.indexed === "no") filtered = filtered.filter((p) => !indexedSlugs.has(p.slug));

  const total = filtered.length;
  const limit = Math.min(q.limit ?? 50, 200);
  const items: BrowsedPage[] = filtered.slice(0, limit).map((p) => ({ ...p, indexed: indexedSlugs.has(p.slug) }));
  return { items, total };
}
