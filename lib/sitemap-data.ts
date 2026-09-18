import { getAllPosts } from "@/lib/blog-posts";
import { getAllPages } from "@/lib/pages";
import { getAllProblems } from "@/lib/problem";
import { getAllProblemPages } from "@/lib/problems-cluster";
import { getAllServices, getAllCities } from "@/lib/catalog";
import { getIndexableSlugSet } from "@/lib/ai-content";
import { getAllBrandPageSlugs } from "@/lib/brand-pages";
import { getSiteUrl } from "@/lib/site";

export interface SitemapEntry {
  loc: string;
  lastmod: string; // YYYY-MM-DD
  changefreq: string;
  priority: number;
}

/** Максимум URL в одной sitemap-карте. Специально маленький (10k при спеке
 *  50k), чтобы money-страницы (гео/хабы/блог) физически лежали в первых
 *  под-картах — Яндекс обходит sitemap по порядку, и на молодом домене с
 *  крошечным краул-бюджетом важно, чтобы важное было первым, а не 57к брендов. */
export const SITEMAP_CHUNK = 10000;

// Стабильная дата контента: не new Date(), иначе lastmod прыгает на каждый билд.
const LAST_MOD = "2026-09-09";
// Свежая дата для секций, которые реально обновились (все гео получили ИИ-текст
// 12.07 — 900 из них вышли из noindex; 09.09 — чистка sitemap-ошибок и SEO-фиксов).
// Сигналит Яндексу «переобойди заново».
const FRESH_MOD = "2026-09-09";

/** Безопасно привести дату (строка/Date) к YYYY-MM-DD, иначе LAST_MOD. */
function toYmd(v: unknown): string {
  try {
    const d = new Date(v as string);
    if (isNaN(d.getTime())) return LAST_MOD;
    return d.toISOString().slice(0, 10);
  } catch {
    return LAST_MOD;
  }
}

let cache: SitemapEntry[] | null = null;

/** Полный упорядоченный список URL сайта (мемоизируется на время жизни процесса). */
export function buildSitemapEntries(): SitemapEntry[] {
  if (cache) return cache;
  const siteUrl = getSiteUrl();
  const indexable = getIndexableSlugSet(); // один запрос вместо 86k getAiContent
  const e: SitemapEntry[] = [];
  const push = (loc: string, priority: number, changefreq = "monthly", lastmod = LAST_MOD) =>
    e.push({ loc, priority, changefreq, lastmod });

  // Главная + хабы
  push(siteUrl, 1.0, "weekly");
  push(`${siteUrl}/uslugi`, 0.9, "weekly");
  push(`${siteUrl}/goroda`, 0.9, "weekly");
  for (const s of getAllServices()) push(`${siteUrl}/uslugi/${s.serviceSlug}`, 0.8, "weekly");
  for (const c of getAllCities()) push(`${siteUrl}/goroda/${c.citySlug}`, 0.8, "weekly");
  push(`${siteUrl}/blog`, 0.8, "daily");
  for (const s of ["o-kompanii", "kontakty", "garantii", "oplata", "kak-rabotaem"]) push(`${siteUrl}/${s}`, 0.6, "monthly");
  for (const post of getAllPosts()) push(`${siteUrl}/blog/${post.slug}`, 0.6, "monthly", toYmd(post.datePublished));
  push(`${siteUrl}/problem`, 0.7, "weekly");

  // Гео-лендинги — money-страницы №1. Высокий приоритет + свежий lastmod
  // (весь блок обновлён 12.07: ИИ-текст на все 4185, 900 вышли из noindex) →
  // Яндекс переобходит их в первую очередь. Гейт уникальности сохранён.
  for (const page of getAllPages()) if (page.slug && indexable.has(page.slug)) push(`${siteUrl}/${page.slug}`, 0.9, "weekly", FRESH_MOD);

  // Проблемные статьи
  for (const problem of getAllProblems()) push(`${siteUrl}/problem/${problem.slug}`, 0.5, "monthly", toYmd(problem.createdAt));

  // Проблемные лендинги — только с уникальным ИИ-текстом (гейт). Средний приоритет.
  for (const p of getAllProblemPages()) {
    if (p.slug && indexable.has(p.slug)) push(`${siteUrl}/problem-service/${p.slug}`, 0.5, "monthly");
  }

  // Бренд-страницы (57к) — намеренно низкий приоритет: на молодом домене не
  // распыляем краул-бюджет на них, подключатся волнами по мере роста доверия.
  for (const slug of getAllBrandPageSlugs()) {
    if (indexable.has(slug)) push(`${siteUrl}/${slug}`, 0.3, "monthly");
  }

  cache = e;
  return e;
}

/** Сколько подкарт нужно. */
export function sitemapChunkCount(): number {
  return Math.max(1, Math.ceil(buildSitemapEntries().length / SITEMAP_CHUNK));
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** XML одной подкарты (chunk id, 0-based). */
export function renderUrlset(id: number): string {
  const all = buildSitemapEntries();
  const slice = all.slice(id * SITEMAP_CHUNK, (id + 1) * SITEMAP_CHUNK);
  const urls = slice
    .map(
      (u) =>
        `<url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod}</lastmod>` +
        `<changefreq>${u.changefreq}</changefreq><priority>${u.priority.toFixed(1)}</priority></url>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

/** XML sitemap-индекса, ссылающегося на все подкарты. */
export function renderSitemapIndex(): string {
  const siteUrl = getSiteUrl();
  const n = sitemapChunkCount();
  const items = Array.from({ length: n }, (_, i) =>
    `<sitemap><loc>${siteUrl}/sitemaps/${i}.xml</loc><lastmod>${LAST_MOD}</lastmod></sitemap>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}
