import fs from "fs";
import path from "path";
import { getContentIndex } from "./content-cache";

const ROOT = process.cwd();

function csvRowCount(file: string): number {
  try {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    return Math.max(0, text.split("\n").filter(Boolean).length - 1);
  } catch {
    return 0;
  }
}

function csvSlugs(file: string): string[] {
  try {
    const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n").filter(Boolean);
    const header = lines[0].split(",");
    const idx = header.indexOf("slug");
    if (idx === -1) return [];
    const out: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const v = lines[i].split(",")[idx];
      if (v) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

/** Один слой контента: тип страниц + сколько из них имеют уникальный ИИ-текст. */
export interface ContentLayerStats {
  key: string;
  label: string;
  total: number;
  indexed: number;
}

export interface ContentStats {
  layers: ContentLayerStats[];
  totalPages: number;
  totalIndexed: number;
  generatedAt: string;
}

export async function getContentStats(): Promise<ContentStats> {
  // Общий кэш вместо парса 225 МБ на каждый запрос (см. content-cache.ts).
  const { indexedSlugs } = await getContentIndex();
  const hasText = (slug: string) => indexedSlugs.has(slug);

  const geoSlugs = csvSlugs("data/pages.csv");
  const problemSlugs = csvSlugs("data/problems-cluster.csv");
  const brandSlugs = csvSlugs("data/brand-pages.csv");

  const layers: ContentLayerStats[] = [
    {
      key: "geo",
      label: "Гео (услуга × город)",
      total: geoSlugs.length,
      indexed: geoSlugs.filter(hasText).length,
    },
    {
      key: "problems",
      label: "Проблемные (поломка × город)",
      total: problemSlugs.length,
      indexed: problemSlugs.filter(hasText).length,
    },
    {
      key: "brands",
      label: "Бренды (техника × бренд × город)",
      total: brandSlugs.length,
      indexed: brandSlugs.filter(hasText).length,
    },
    {
      key: "blog",
      label: "Блог",
      total: csvRowCount("data/blog-posts.csv"),
      indexed: csvRowCount("data/blog-posts.csv"),
    },
    {
      key: "hubs",
      label: "Хабы + трастовые + прочее",
      total: 280 + 16 + 6 + 101 + 1, // города + услуги + трастовые + problem-статьи + главная
      indexed: 280 + 16 + 6 + 101 + 1,
    },
  ];

  const totalPages = layers.reduce((s, l) => s + l.total, 0);
  const totalIndexed = layers.reduce((s, l) => s + l.indexed, 0);

  return { layers, totalPages, totalIndexed, generatedAt: new Date().toISOString() };
}
