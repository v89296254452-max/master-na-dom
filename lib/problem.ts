import fs from "fs";
import path from "path";
import type { Page } from "./pages";
import { getAllPages, getOtherServicesInCity, getPhone, getServiceSlug, formatServiceInCity } from "./pages";
import type { ProblemArticle, ProblemLink, ProblemListItem } from "./problem-types";

const DATA_PATH = path.join(process.cwd(), "data", "problems.json");

let cache: ProblemArticle[] | null = null;
let slugSet: Set<string> | null = null;

function loadProblems(): ProblemArticle[] {
  if (cache) return cache;

  try {
    if (!fs.existsSync(DATA_PATH)) {
      cache = [];
      slugSet = new Set();
      return cache;
    }

    cache = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8")) as ProblemArticle[];
    slugSet = new Set(cache.map((p) => p.slug));
    return cache;
  } catch {
    cache = [];
    slugSet = new Set();
    return cache;
  }
}

export function getAllProblems(): ProblemArticle[] {
  return loadProblems();
}

export function getProblemBySlug(slug: string): ProblemArticle | undefined {
  return loadProblems().find((p) => p.slug === slug);
}

export function problemExists(slug: string): boolean {
  if (!slugSet) loadProblems();
  return slugSet?.has(slug) ?? false;
}

export function hashProblemSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getProblemsForPage(page: Page, limit = 8): ProblemListItem[] {
  const serviceSlug = getServiceSlug(page);
  const city = page.city || "";

  const matched = loadProblems().filter(
    (p) => p.serviceSlug === serviceSlug && p.city === city
  );

  if (matched.length === 0) {
    return loadProblems()
      .filter((p) => p.serviceSlug === serviceSlug)
      .slice(0, limit)
      .map(toListItem);
  }

  const seed = hashProblemSlug(page.slug || `${serviceSlug}-${city}`);
  const sorted = [...matched].sort(
    (a, b) =>
      (hashProblemSlug(a.slug) % 100) - (hashProblemSlug(b.slug) % 100) ||
      a.problemTitle.localeCompare(b.problemTitle, "ru")
  );

  const rotated = [
    ...sorted.slice(seed % sorted.length),
    ...sorted.slice(0, seed % sorted.length),
  ];

  return rotated.slice(0, limit).map(toListItem);
}

function toListItem(problem: ProblemArticle): ProblemListItem {
  return {
    slug: problem.slug,
    title: problem.title,
    problemTitle: problem.problemTitle,
    href: `/problem/${problem.slug}`,
  };
}

export function getRelatedProblems(problem: ProblemArticle, limit = 6): ProblemLink[] {
  const all = loadProblems();
  const bySlug = new Map(all.map((p) => [p.slug, p]));

  const fromRefs = problem.relatedProblems
    .map((slug) => bySlug.get(slug))
    .filter((p): p is ProblemArticle => Boolean(p))
    .slice(0, limit);

  if (fromRefs.length >= limit) {
    return fromRefs.map((p) => ({ title: p.problemTitle, href: `/problem/${p.slug}` }));
  }

  const extra = all
    .filter(
      (p) =>
        p.slug !== problem.slug &&
        p.serviceSlug === problem.serviceSlug &&
        p.city === problem.city &&
        !fromRefs.some((r) => r.slug === p.slug)
    )
    .slice(0, limit - fromRefs.length);

  return [...fromRefs, ...extra].map((p) => ({
    title: p.problemTitle,
    href: `/problem/${p.slug}`,
  }));
}

export function getRelatedServicesForProblem(problem: ProblemArticle, limit = 5): ProblemLink[] {
  if (problem.relatedServices?.length) {
    return problem.relatedServices.slice(0, limit);
  }

  const page = getAllPages().find((p) => p.slug === problem.targetUrl.replace(/^\//, ""));
  if (!page) {
    return [{ title: `${problem.service} в ${problem.cityPrepositional}`, href: problem.targetUrl }];
  }

  return [
    { title: formatServiceInCity(page), href: problem.targetUrl },
    ...getOtherServicesInCity(page, limit - 1).map((p) => ({
      title: formatServiceInCity(p),
      href: `/${p.slug}`,
    })),
  ];
}

export function getProblemsByService(serviceSlug: string, limit = 20): ProblemArticle[] {
  return loadProblems()
    .filter((p) => p.serviceSlug === serviceSlug)
    .slice(0, limit);
}

export function getProblemPhoneHref(problem: ProblemArticle): string {
  const phone = getPhone(problem.phone);
  return `tel:${phone.replace(/\D/g, "")}`;
}

export function getProblemPhone(problem: ProblemArticle): string {
  return getPhone(problem.phone);
}
