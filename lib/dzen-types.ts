export type DzenArticleStatus = "draft" | "copied" | "published" | "error";

export interface DzenArticle {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  cta: string;
  tags: string[];
  targetUrl: string;
  service: string;
  city: string;
  phone: string;
  slug: string;
  coverImage: string;
  imageUrls: string[];
  status: DzenArticleStatus;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DzenArticlesStore {
  articles: DzenArticle[];
  generatedAt?: string;
}

export const DZEN_TARGET_SERVICE_SLUGS = [
  "santehnik",
  "elektrik",
  "remont-stiralnyh-mashin",
  "remont-holodilnikov",
  "kp",
] as const;

export type DzenTargetServiceSlug = (typeof DZEN_TARGET_SERVICE_SLUGS)[number];

export const DZEN_CITY_LIMIT = 20;

export const DZEN_ARTICLE_STATUSES: DzenArticleStatus[] = ["draft", "copied", "published", "error"];

export type DzenArticleUpdate = Partial<Pick<DzenArticle, "status" | "publishedUrl">>;
