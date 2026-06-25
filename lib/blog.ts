import fs from "fs";
import path from "path";
import type { Page } from "./pages";
import { getAllPages, getServiceSlug } from "./pages";
import type { BlogArticle, BlogArticleLink } from "./blog-types";

const DATA_PATH = path.join(process.cwd(), "data", "blog-articles.json");

let cache: BlogArticle[] | null = null;
let slugSet: Set<string> | null = null;

function loadArticles(): BlogArticle[] {
  if (cache) return cache;

  try {
    if (!fs.existsSync(DATA_PATH)) {
      cache = [];
      slugSet = new Set();
      return cache;
    }

    cache = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8")) as BlogArticle[];
    slugSet = new Set(cache.map((a) => a.slug));
    return cache;
  } catch {
    cache = [];
    slugSet = new Set();
    return cache;
  }
}

export function getAllBlogArticles(): BlogArticle[] {
  return loadArticles();
}

export function getBlogArticleBySlug(slug: string): BlogArticle | undefined {
  return loadArticles().find((a) => a.slug === slug);
}

export function blogArticleExists(slug: string): boolean {
  if (!slugSet) loadArticles();
  return slugSet?.has(slug) ?? false;
}

export function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getArticleParagraphs(article: BlogArticle): string[] {
  if (!article.content || typeof article.content !== "string") {
    return [article.description || ""].filter(Boolean);
  }

  return article.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function getSimilarArticles(article: BlogArticle, limit = 5): BlogArticleLink[] {
  const all = loadArticles().filter((a) => a.slug !== article.slug);
  const seed = hashSlug(article.slug);

  const scored = all
    .map((a, index) => {
      let score = 0;
      if (a.serviceSlug === article.serviceSlug) score += 3;
      if (a.city === article.city) score += 2;
      for (const tag of article.tags) {
        if (a.tags.includes(tag)) score += 1;
      }
      return { a, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((x, y) => y.score - x.score || x.index - y.index);

  const pool = scored.length >= limit ? scored : all.map((a, index) => ({ a, score: 0, index }));
  const picked: BlogArticle[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < pool.length && picked.length < limit; i++) {
    const item = pool[(seed + i * 7) % pool.length];
    if (!seen.has(item.a.slug)) {
      seen.add(item.a.slug);
      picked.push(item.a);
    }
  }

  return picked.map((a) => ({
    title: a.title,
    href: `/blog/${a.slug}`,
  }));
}

export function getCommercialLinksForArticle(article: BlogArticle, limit = 5): BlogArticleLink[] {
  const pages = getAllPages();
  const city = article.city;
  const seed = hashSlug(`${article.slug}-commercial`);

  const sameCity = pages.filter((p) => p.city === city && p.slug !== article.targetUrl.replace(/^\//, ""));

  const related = sameCity.filter(
    (p) => getServiceSlug(p) === article.serviceSlug || p.serviceSlug === article.serviceSlug
  );

  const pool = [...related, ...sameCity];
  const picked: Page[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < pool.length && picked.length < limit; i++) {
    const page = pool[(seed + i * 11) % pool.length];
    if (!page.slug || seen.has(page.slug)) continue;
    seen.add(page.slug);
    picked.push(page);
  }

  return picked.map((p) => ({
    title: `${p.service} в ${p.cityPrepositional || p.city}`,
    href: `/${p.slug}`,
  }));
}

export function getRelatedBlogArticles(page: Page, limit = 6): BlogArticleLink[] {
  try {
    const serviceSlug = getServiceSlug(page);
    const city = page.city || "";
    const all = loadArticles();

    if (all.length === 0) return [];

    const seed = hashSlug(page.slug || serviceSlug);

    const related = all.filter(
      (a) => a.serviceSlug === serviceSlug || a.city === city
    );

    const pool = related.length >= limit ? related : all;
    const picked: BlogArticle[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < pool.length && picked.length < limit; i++) {
      const article = pool[(seed + i * 7) % pool.length];
      if (!seen.has(article.slug)) {
        seen.add(article.slug);
        picked.push(article);
      }
    }

    return picked.map((a) => ({
      title: a.title,
      href: `/blog/${a.slug}`,
    }));
  } catch {
    return [];
  }
}

export function getBlogArticlesByCity(city: string, limit = 20): BlogArticle[] {
  return loadArticles()
    .filter((a) => a.city === city)
    .slice(0, limit);
}

export function getBlogArticlesByService(serviceSlug: string, limit = 20): BlogArticle[] {
  return loadArticles()
    .filter((a) => a.serviceSlug === serviceSlug)
    .slice(0, limit);
}
