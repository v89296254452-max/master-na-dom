/**
 * Единый реестр всех индексируемых SEO-URL сайта — источник правды для
 * дальнейшего анализа (opportunity score, cannibalization, similarity,
 * city hub coverage). Строится СТАТИЧЕСКИ, из тех же данных и тех же
 * функций, что использует рендер (lib/pages, lib/brand-pages, lib/
 * problems-cluster, lib/problem, lib/seo/meta, lib/catalog) — НЕ живым
 * обходом сайта по HTTP (после инцидента с падением памяти от массового
 * обхода мы сознательно не добавляем ещё один источник такой нагрузки,
 * см. docs/PRODUCTION-MEMORY-AUDIT.md).
 *
 *   npx tsx scripts/seo/build-registry.ts
 *
 * Пишет reports/seo-pages.csv и reports/seo-pages.json.
 *
 * Все показатели детерминированные (никакого LLM/эвристической "оценки
 * качества"): title/description/H1 — те же чистые функции, что вызывает
 * рендер; internalLinksOut — та же фильтрующая логика, что и в компонентах
 * страниц; internalLinksIn/clickDepth — посчитаны обходом графа исходящих
 * ссылок, который мы только что построили для всех страниц.
 */
import fs from "fs";
import path from "path";
import { getAllPages, getOtherServicesInCity, getPopularCitiesForService, getServiceSlug, type Page } from "../../lib/pages";
import { getAllBrandPageSlugs, getBrandPageBySlug } from "../../lib/brand-pages";
import { getBrandsForService } from "../../lib/brands";
import { getAllCities, getAllServices, getCitySlug } from "../../lib/catalog";
import { getAllProblems } from "../../lib/problem";
import { getAllProblemPages, getParentSlug, getProblemPagesForServiceCity } from "../../lib/problems-cluster";
import { getAllPosts } from "../../lib/blog-posts";
import { getIndexableSlugSet, getAiContent } from "../../lib/ai-content";
import { getExtendedFaqs } from "../../lib/seo/faqs";
import { getExtendedPrices } from "../../lib/seo/prices";
import {
  buildGeoTitle, buildGeoDescription, buildBrandTitle, buildBrandDescription,
  buildProblemTitle, buildProblemDescription, buildCityHubTitle, buildCityHubDescription,
  buildServiceHubTitle, buildServiceHubDescription,
} from "../../lib/seo/meta";
import { getSiteUrl } from "../../lib/site";

const SITE_URL = getSiteUrl();
const indexable = getIndexableSlugSet();

type PageType = "HOME" | "CITY" | "SERVICE" | "SERVICE_CITY" | "BRAND" | "PROBLEM" | "PROBLEM_SERVICE" | "BLOG";

interface Row {
  url: string;
  pageType: PageType;
  city: string;
  service: string;
  problem: string;
  brand: string;
  title: string;
  description: string;
  h1: string;
  canonical: string;
  robots: "index" | "noindex";
  status: number;
  internalLinksOut: number;
  internalLinksIn: number; // filled in second pass
  clickDepth: number; // filled in third pass (BFS from HOME)
  wordCount: number;
  schemaTypes: string;
  hasFAQ: boolean;
  hasPrices: boolean;
  hasLocalContent: boolean;
}

const rows: Row[] = [];
const outLinks = new Map<string, Set<string>>(); // slug (path, no leading /) -> set of linked slugs

function addLink(fromSlug: string, toSlug: string) {
  // fromSlug === "" is a valid, meaningful value (HOME) - only toSlug being
  // empty or a self-link should be rejected. (Bug found in first run: `!fromSlug`
  // treated "" as falsy and silently dropped every edge originating at HOME,
  // which made the BFS below mark 51543/51544 pages as "orphan" - a bug in
  // this script, not a real finding about the site.)
  if (!toSlug || fromSlug === toSlug) return;
  if (!outLinks.has(fromSlug)) outLinks.set(fromSlug, new Set());
  outLinks.get(fromSlug)!.add(toSlug);
}

function wc(text: string): number {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

// ---------- HOME ----------
rows.push({
  url: SITE_URL + "/", pageType: "HOME", city: "", service: "", problem: "", brand: "",
  title: "ПроМастер — бытовые услуги", description: "", h1: "",
  canonical: SITE_URL + "/", robots: "index", status: 200,
  internalLinksOut: 0, internalLinksIn: 0, clickDepth: 0,
  wordCount: 0, schemaTypes: "Organization,WebSite", hasFAQ: false, hasPrices: false, hasLocalContent: false,
});
// Home links out to hubs (uslugi, goroda, blog) + first-screen service/city grids.
addLink("", "uslugi"); addLink("", "goroda"); addLink("", "blog");

// ---------- CITY hubs ----------
for (const c of getAllCities()) {
  const slug = `goroda/${c.citySlug}`;
  const title = buildCityHubTitle(c.cityPrepositional || c.city);
  rows.push({
    url: `${SITE_URL}/${slug}`, pageType: "CITY", city: c.city, service: "", problem: "", brand: "",
    title, description: buildCityHubDescription(c.cityPrepositional || c.city, []), h1: title,
    canonical: `${SITE_URL}/${slug}`, robots: "index", status: 200,
    internalLinksOut: 0, internalLinksIn: 0, clickDepth: 0,
    wordCount: 0, schemaTypes: "BreadcrumbList,Organization", hasFAQ: false, hasPrices: false, hasLocalContent: true,
  });
  addLink("", slug);
  // City hub links to every service-city page for that city (the actual coverage question, Этап 6).
  let linkCount = 0;
  for (const p of getAllPages()) {
    if (p.city === c.city && p.slug) { addLink(slug, p.slug); linkCount++; }
  }
  rows[rows.length - 1].internalLinksOut = linkCount;
}

// ---------- SERVICE hubs ----------
for (const s of getAllServices()) {
  const slug = `uslugi/${s.serviceSlug}`;
  const cityCount = getAllPages().filter((p) => getServiceSlug(p) === s.serviceSlug).length;
  const title = buildServiceHubTitle(s.service, cityCount);
  rows.push({
    url: `${SITE_URL}/${slug}`, pageType: "SERVICE", city: "", service: s.service, problem: "", brand: "",
    title, description: buildServiceHubDescription(s.service, cityCount), h1: title,
    canonical: `${SITE_URL}/${slug}`, robots: "index", status: 200,
    internalLinksOut: 0, internalLinksIn: 0, clickDepth: 0,
    wordCount: 0, schemaTypes: "BreadcrumbList,Organization", hasFAQ: false, hasPrices: false, hasLocalContent: false,
  });
  addLink("", slug);
  let linkCount = 0;
  for (const p of getAllPages()) {
    if (getServiceSlug(p) === s.serviceSlug && p.slug) { addLink(slug, p.slug); linkCount++; }
  }
  rows[rows.length - 1].internalLinksOut = linkCount;
}

// ---------- SERVICE_CITY (the core commercial pages) ----------
const allPages = getAllPages();
for (const page of allPages) {
  if (!page.slug) continue;
  const service = page.service || "";
  const city = page.city || "";
  const cityPrep = page.cityPrepositional || city;
  const title = buildGeoTitle(service, cityPrep);
  const description = buildGeoDescription(service, cityPrep, page.slug);
  const faqs = getExtendedFaqs(page);
  const prices = getExtendedPrices(page);
  const ai = getAiContent(page.slug);
  const bodyWords = ai?.paragraphs?.join(" ") ?? "";
  const isIndexable = indexable.has(page.slug);

  const serviceSlug = getServiceSlug(page);
  const citySlug = getCitySlug(page);
  const otherServices = getOtherServicesInCity(page, 8);
  const otherCities = getPopularCitiesForService(page, 12);
  const clusterProblems = getProblemPagesForServiceCity(serviceSlug, city, 8);
  const brands = getBrandsForService(serviceSlug).filter((b) =>
    citySlug ? indexable.has(`${serviceSlug}-${b.slug}-${citySlug}`) : false
  );

  rows.push({
    url: `${SITE_URL}/${page.slug}`, pageType: "SERVICE_CITY", city, service, problem: "", brand: "",
    title, description, h1: page.h1 || `${service} в ${cityPrep}`,
    canonical: `${SITE_URL}/${page.slug}`, robots: isIndexable ? "index" : "noindex", status: 200,
    internalLinksOut: 0, internalLinksIn: 0, clickDepth: 0,
    wordCount: wc(bodyWords),
    schemaTypes: "BreadcrumbList,LocalBusiness,Service,FAQPage,Organization,WebSite",
    hasFAQ: faqs.length > 0, hasPrices: prices.length > 0, hasLocalContent: !!ai,
  });

  addLink(page.slug, `goroda/${citySlug}`);
  addLink(page.slug, `uslugi/${serviceSlug}`);
  for (const p of otherServices) addLink(page.slug, p.slug);
  for (const p of otherCities) addLink(page.slug, p.slug);
  for (const pr of clusterProblems) addLink(page.slug, `problem-service/${pr.slug}`);
  for (const b of brands) addLink(page.slug, `${serviceSlug}-${b.slug}-${citySlug}`);
  rows[rows.length - 1].internalLinksOut =
    2 + otherServices.length + otherCities.length + clusterProblems.length + brands.length;
}
console.error(`[registry] SERVICE_CITY: ${allPages.length}`);

// ---------- BRAND ----------
const brandSlugs = getAllBrandPageSlugs();
for (const slug of brandSlugs) {
  const bp = getBrandPageBySlug(slug);
  if (!bp) continue;
  const isIndexable = indexable.has(slug);
  const ai = getAiContent(slug);
  const title = buildBrandTitle(bp.service, bp.brand, bp.cityDat);
  const description = buildBrandDescription(bp.service, bp.brand, bp.cityDat, slug);
  rows.push({
    url: `${SITE_URL}/${slug}`, pageType: "BRAND", city: bp.city, service: bp.service, problem: "", brand: bp.brand,
    title, description, h1: `${bp.service} ${bp.brand} в ${bp.cityDat}`,
    canonical: `${SITE_URL}/${slug}`, robots: isIndexable ? "index" : "noindex", status: 200,
    internalLinksOut: 2, internalLinksIn: 0, clickDepth: 0,
    wordCount: wc(ai?.paragraphs?.join(" ") ?? ""),
    schemaTypes: "BreadcrumbList,LocalBusiness,Service,Organization,WebSite",
    hasFAQ: false, hasPrices: false, hasLocalContent: !!ai,
  });
  // Brand pages link back to their parent service-city page (confirmed in code read).
  addLink(slug, bp.parent.slug);
  addLink(slug, `uslugi/${bp.serviceSlug}`);
}
console.error(`[registry] BRAND: ${brandSlugs.length}`);

// ---------- PROBLEM (статьи) ----------
for (const problem of getAllProblems()) {
  rows.push({
    url: `${SITE_URL}/problem/${problem.slug}`, pageType: "PROBLEM", city: problem.city, service: problem.service,
    problem: problem.problemTitle || problem.title, brand: "",
    title: problem.title, description: problem.description, h1: problem.title,
    canonical: `${SITE_URL}/problem/${problem.slug}`, robots: "index", status: 200,
    internalLinksOut: 2, internalLinksIn: 0, clickDepth: 0,
    wordCount: wc([problem.whyHappens, ...(problem.selfCheck || []), ...(problem.whenCall || [])].filter(Boolean).join(" ")),
    schemaTypes: "BreadcrumbList,Article",
    hasFAQ: (problem.faqs || []).length > 0, hasPrices: !!problem.priceHint, hasLocalContent: true,
  });
  addLink(`problem/${problem.slug}`, "problem");
}
console.error(`[registry] PROBLEM: ${getAllProblems().length}`);

// ---------- PROBLEM_SERVICE ----------
for (const pp of getAllProblemPages()) {
  const isIndexable = indexable.has(pp.slug);
  const ai = getAiContent(pp.slug);
  const title = buildProblemTitle(pp.problem, pp.service.toLowerCase(), pp.cityDat);
  const description = buildProblemDescription(pp.problem, pp.service.toLowerCase(), pp.cityDat, pp.slug);
  const parentSlug = getParentSlug(pp);
  rows.push({
    url: `${SITE_URL}/problem-service/${pp.slug}`, pageType: "PROBLEM_SERVICE", city: pp.city, service: pp.service,
    problem: pp.problem, brand: "",
    title, description, h1: pp.h1 || `«${pp.problem}» в ${pp.cityDat}`,
    canonical: `${SITE_URL}/problem-service/${pp.slug}`, robots: isIndexable ? "index" : "noindex", status: 200,
    internalLinksOut: 1, internalLinksIn: 0, clickDepth: 0,
    wordCount: wc(ai?.paragraphs?.join(" ") ?? ""),
    schemaTypes: "BreadcrumbList,LocalBusiness,FAQPage",
    hasFAQ: true, hasPrices: true, hasLocalContent: !!ai,
  });
  addLink(`problem-service/${pp.slug}`, parentSlug);
}
console.error(`[registry] PROBLEM_SERVICE: ${getAllProblemPages().length}`);

// ---------- BLOG ----------
for (const post of getAllPosts()) {
  rows.push({
    url: `${SITE_URL}/blog/${post.slug}`, pageType: "BLOG", city: "", service: post.serviceSlug || "", problem: "", brand: "",
    title: post.title, description: post.description || "", h1: post.title,
    canonical: `${SITE_URL}/blog/${post.slug}`, robots: "index", status: 200,
    internalLinksOut: post.serviceSlug ? 2 : 1, internalLinksIn: 0, clickDepth: 0,
    wordCount: wc(post.content || ""),
    schemaTypes: "BreadcrumbList,Article",
    hasFAQ: false, hasPrices: false, hasLocalContent: false,
  });
  addLink(`blog/${post.slug}`, "blog");
  if (post.serviceSlug) addLink(`blog/${post.slug}`, `uslugi/${post.serviceSlug}`);
}
console.error(`[registry] BLOG: ${getAllPosts().length}`);

// ---------- second pass: internalLinksIn ----------
const linksInCount = new Map<string, number>();
for (const [, targets] of outLinks) {
  for (const t of targets) {
    linksInCount.set(t, (linksInCount.get(t) || 0) + 1);
  }
}
function slugOf(url: string): string {
  return url.replace(SITE_URL + "/", "").replace(/\/$/, "");
}
for (const r of rows) {
  const key = r.pageType === "HOME" ? "" : slugOf(r.url);
  r.internalLinksIn = linksInCount.get(key) || 0;
}

// ---------- third pass: clickDepth via BFS from HOME ----------
const depth = new Map<string, number>();
depth.set("", 0);
let frontier = [""];
while (frontier.length) {
  const next: string[] = [];
  for (const node of frontier) {
    const d = depth.get(node)!;
    for (const t of outLinks.get(node) || []) {
      if (!depth.has(t)) {
        depth.set(t, d + 1);
        next.push(t);
      }
    }
  }
  frontier = next;
}
for (const r of rows) {
  const key = r.pageType === "HOME" ? "" : slugOf(r.url);
  r.clickDepth = depth.has(key) ? depth.get(key)! : -1; // -1 = orphan, unreachable from HOME
}

// ---------- write output ----------
const REPORTS_DIR = path.join(process.cwd(), "reports");
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const csvHeader = [
  "url", "pageType", "city", "service", "problem", "brand", "title", "description", "h1",
  "canonical", "robots", "status", "internalLinksIn", "internalLinksOut", "clickDepth",
  "wordCount", "schemaTypes", "hasFAQ", "hasPrices", "hasLocalContent",
];
function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvLines = [csvHeader.join(",")];
for (const r of rows) {
  csvLines.push(
    [
      r.url, r.pageType, r.city, r.service, r.problem, r.brand, r.title, r.description, r.h1,
      r.canonical, r.robots, r.status, r.internalLinksIn, r.internalLinksOut, r.clickDepth,
      r.wordCount, r.schemaTypes, r.hasFAQ, r.hasPrices, r.hasLocalContent,
    ].map(csvEscape).join(",")
  );
}
fs.writeFileSync(path.join(REPORTS_DIR, "seo-pages.csv"), csvLines.join("\n"), "utf-8");
fs.writeFileSync(path.join(REPORTS_DIR, "seo-pages.json"), JSON.stringify(rows, null, 0), "utf-8");

const byType: Record<string, number> = {};
const orphans: string[] = [];
for (const r of rows) {
  byType[r.pageType] = (byType[r.pageType] || 0) + 1;
  if (r.clickDepth === -1) orphans.push(r.url);
}
console.error(`[registry] TOTAL rows: ${rows.length}`);
console.error(`[registry] by type: ${JSON.stringify(byType)}`);
console.error(`[registry] orphan (unreachable from HOME via computed link graph): ${orphans.length}`);
console.error(`[registry] wrote reports/seo-pages.csv and reports/seo-pages.json`);
