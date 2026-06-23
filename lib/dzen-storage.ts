import fs from "fs";
import path from "path";
import type { DzenArticle, DzenArticlesStore, DzenArticleStatus, DzenArticleUpdate } from "./dzen-types";
import { DZEN_ARTICLE_STATUSES } from "./dzen-types";

const DZEN_ARTICLES_PATH = path.join(process.cwd(), "data", "dzen-articles.json");

const VALID_STATUSES = new Set<DzenArticleStatus>(DZEN_ARTICLE_STATUSES);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => normalizeString(item)).filter(Boolean))];
}

function normalizeArticle(raw: unknown): DzenArticle | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Partial<DzenArticle>;
  const status = normalizeString(source.status) as DzenArticle["status"];
  const createdAt = normalizeString(source.createdAt);
  const updatedAt = normalizeString(source.updatedAt);

  if (
    !source.id ||
    !source.title ||
    !source.body ||
    !source.slug ||
    !createdAt ||
    !updatedAt ||
    !VALID_STATUSES.has(status)
  ) {
    return null;
  }

  return {
    id: normalizeString(source.id),
    title: normalizeString(source.title),
    subtitle: normalizeString(source.subtitle),
    body: normalizeString(source.body),
    cta: normalizeString(source.cta),
    tags: normalizeTags(source.tags),
    targetUrl: normalizeString(source.targetUrl),
    service: normalizeString(source.service),
    city: normalizeString(source.city),
    phone: normalizeString(source.phone),
    slug: normalizeString(source.slug),
    coverImage: normalizeString(source.coverImage),
    imageUrls: normalizeTags(source.imageUrls),
    status,
    publishedUrl: source.publishedUrl ? normalizeString(source.publishedUrl) : null,
    createdAt,
    updatedAt,
  };
}

export function isDzenArticleStatus(value: unknown): value is DzenArticleStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as DzenArticleStatus);
}

export function normalizeDzenArticlesStore(raw: unknown): DzenArticlesStore {
  if (!raw || typeof raw !== "object") {
    return { articles: [] };
  }

  const source = raw as Partial<DzenArticlesStore>;
  const articles = Array.isArray(source.articles)
    ? source.articles
        .map(normalizeArticle)
        .filter((article): article is DzenArticle => article !== null)
    : [];

  return {
    articles,
    generatedAt: source.generatedAt ? normalizeString(source.generatedAt) : undefined,
  };
}

export function readDzenArticlesFile(): DzenArticlesStore {
  if (!fs.existsSync(DZEN_ARTICLES_PATH)) {
    return { articles: [] };
  }

  try {
    const content = fs.readFileSync(DZEN_ARTICLES_PATH, "utf-8").trim();
    if (!content) {
      return { articles: [] };
    }

    const parsed = JSON.parse(content) as unknown;
    return normalizeDzenArticlesStore(parsed);
  } catch {
    return { articles: [] };
  }
}

export function writeDzenArticlesFile(store: DzenArticlesStore): void {
  const dir = path.dirname(DZEN_ARTICLES_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(DZEN_ARTICLES_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

export function getDzenArticlesPath(): string {
  return DZEN_ARTICLES_PATH;
}

export function getAllArticles(): DzenArticle[] {
  return readDzenArticlesFile().articles;
}

export function getArticleById(id: string): DzenArticle | undefined {
  const normalizedId = id.trim();
  if (!normalizedId) {
    return undefined;
  }

  return getAllArticles().find((article) => article.id === normalizedId);
}

export function saveArticles(articles: DzenArticle[]): void {
  const store = readDzenArticlesFile();
  writeDzenArticlesFile({
    ...store,
    articles,
  });
}

export function updateArticle(id: string, partialData: DzenArticleUpdate): DzenArticle | null {
  const normalizedId = id.trim();
  if (!normalizedId) {
    return null;
  }

  if (partialData.status !== undefined && !isDzenArticleStatus(partialData.status)) {
    throw new Error(`Некорректный status: ${String(partialData.status)}`);
  }

  const store = readDzenArticlesFile();
  const index = store.articles.findIndex((article) => article.id === normalizedId);
  if (index === -1) {
    return null;
  }

  const current = store.articles[index];
  const updated: DzenArticle = {
    ...current,
    ...partialData,
    updatedAt: nowIso(),
  };

  store.articles[index] = updated;
  saveArticles(store.articles);
  return updated;
}
