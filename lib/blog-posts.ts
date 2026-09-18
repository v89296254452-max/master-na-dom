import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { slugify } from "./transliterate";
import {
  getAllPages,
  getServiceSlug,
  formatServiceInCity,
  POPULAR_CITY_NAMES,
} from "./pages";

/**
 * Блог: общие SEO-статьи (без геопривязки).
 * Метаданные — data/blog-posts.csv, тело статьи — content/blog/{slug}.mdx
 * (frontmatter + Markdown). Кэш в памяти обязателен.
 */

export interface BlogPost {
  slug: string;
  title: string;
  h1: string;
  description: string;
  category: string;
  categoryName: string;
  service: string;
  serviceSlug: string;
  keywords: string[];
  datePublished: string;
  readTime: number;
  content: string;
}

export const BLOG_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "sovety", name: "Советы" },
  { slug: "remont", name: "Ремонт и диагностика" },
  { slug: "vybor", name: "Выбор" },
  { slug: "ceny", name: "Цены" },
  { slug: "instrukcia", name: "Инструкции" },
];

const CATEGORY_NAME = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c.name]));

export const SERVICE_SLUG_BY_NAME: Record<string, string> = {
  "Сантехник": "santehnik",
  "Электрик": "elektrik",
  "Ремонт стиральных машин": "remont-stiralnyh-mashin",
  "Ремонт холодильников": "remont-holodilnikov",
  "Компьютерная помощь": "kp",
  "Мастер на час": "master-na-chas",
  "Ремонт посудомоечных машин": "remont-pmm",
  "Ремонт кондиционеров": "remont-kondicionerov",
};

const CSV_PATH = path.join(process.cwd(), "data", "blog-posts.csv");
const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

let cache: BlogPost[] | null = null;
let cacheBySlug: Map<string, BlogPost> | null = null;

function safeString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function stripFrontmatter(raw: string): string {
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end !== -1) {
      const after = raw.indexOf("\n", end + 1);
      return after !== -1 ? raw.slice(after + 1).trim() : "";
    }
  }
  return raw.trim();
}

function readContent(slug: string): string {
  try {
    const file = path.join(CONTENT_DIR, `${slug}.mdx`);
    if (!fs.existsSync(file)) return "";
    return stripFrontmatter(fs.readFileSync(file, "utf-8"));
  } catch {
    return "";
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function normalize(raw: Record<string, unknown>): BlogPost {
  const slug = safeString(raw.slug);
  const category = safeString(raw.category) || "sovety";
  const service = safeString(raw.service);
  const content = readContent(slug);
  const keywords = safeString(raw.keywords)
    .split(/[;|]/)
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    slug,
    title: safeString(raw.title),
    h1: safeString(raw.h1) || safeString(raw.title),
    description: safeString(raw.description),
    category,
    categoryName: CATEGORY_NAME.get(category) ?? "Статьи",
    service,
    serviceSlug: SERVICE_SLUG_BY_NAME[service] ?? (service ? slugify(service) : ""),
    keywords,
    datePublished: safeString(raw.datePublished),
    readTime: Math.max(1, Math.round(countWords(content) / 180)),
    content,
  };
}

function load(): BlogPost[] {
  if (cache) return cache;

  if (!fs.existsSync(CSV_PATH)) {
    cache = [];
    cacheBySlug = new Map();
    return cache;
  }

  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  cache = rows
    .map(normalize)
    .filter((p) => p.slug)
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));
  cacheBySlug = new Map(cache.map((p) => [p.slug, p]));
  return cache;
}

export function getAllPosts(): BlogPost[] {
  return load();
}

export function getPostBySlug(slug: string): BlogPost | null {
  if (!cacheBySlug) load();
  return cacheBySlug?.get(slug) ?? null;
}

export function getPostsByService(serviceSlug: string): BlogPost[] {
  return load().filter((p) => p.serviceSlug === serviceSlug);
}

export function getPostsByCategory(category: string): BlogPost[] {
  return load().filter((p) => p.category === category);
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const current = getPostBySlug(slug);
  if (!current) return [];

  const scored = load()
    .filter((p) => p.slug !== slug)
    .map((p) => {
      let score = 0;
      if (p.serviceSlug === current.serviceSlug) score += 3;
      if (p.category === current.category) score += 1;
      for (const kw of current.keywords) {
        if (p.keywords.includes(kw)) score += 1;
      }
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.p);
}

export interface ServiceCityLink {
  title: string;
  href: string;
}

/** Ссылки на коммерческие страницы услуги в популярных городах (для CTA в статьях). */
export function getServiceCityLinks(serviceSlug: string, limit = 5): ServiceCityLink[] {
  if (!serviceSlug) return [];
  const pages = getAllPages().filter(
    (p) => getServiceSlug(p) === serviceSlug && p.slug && p.city
  );
  const byCity = new Map(pages.map((p) => [p.city, p]));
  const picked: ServiceCityLink[] = [];
  const seen = new Set<string>();

  for (const cityName of POPULAR_CITY_NAMES) {
    if (picked.length >= limit) break;
    const match = byCity.get(cityName);
    if (match && !seen.has(match.slug)) {
      seen.add(match.slug);
      picked.push({ title: formatServiceInCity(match), href: `/${match.slug}` });
    }
  }

  if (picked.length < limit) {
    for (const p of pages) {
      if (picked.length >= limit) break;
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      picked.push({ title: formatServiceInCity(p), href: `/${p.slug}` });
    }
  }

  return picked;
}

export interface TocItem {
  id: string;
  text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Извлекает FAQ из секции «## Частые вопросы» (### вопрос + абзац-ответ). */
export function getFaq(content: string): FaqItem[] {
  const lines = content.split("\n");
  const startIdx = lines.findIndex((l) => /^##\s+Частые вопросы/i.test(l.trim()));
  if (startIdx === -1) return [];

  const faq: FaqItem[] = [];
  let current: FaqItem | null = null;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^##\s/.test(trimmed) && !trimmed.startsWith("###")) break;

    if (trimmed.startsWith("### ")) {
      if (current && current.answer) faq.push(current);
      current = { question: trimmed.slice(4).trim(), answer: "" };
    } else if (trimmed && current && !current.answer) {
      current.answer = trimmed;
    }
  }
  if (current && current.answer) faq.push(current);

  return faq;
}

export function getToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of content.split("\n")) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m && !line.startsWith("###")) {
      const text = m[1].replace(/\*\*/g, "").trim();
      items.push({ id: slugify(text), text });
    }
  }
  return items;
}
