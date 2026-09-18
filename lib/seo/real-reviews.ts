import fs from "fs";
import path from "path";

/**
 * РЕАЛЬНЫЕ отзывы (data/real-reviews.json) — единственный источник для разметки
 * AggregateRating/Review.
 *
 * Правило: звёзды в сниппете выводим ТОЛЬКО по реальным подтверждённым отзывам.
 * Нет данных — разметки рейтинга нет. Выдуманные отзывы + Review-разметка =
 * прямая причина ручных санкций Яндекса/Google, поэтому фолбэков тут нет.
 *
 * Наполняется по мере появления отзывов (Яндекс.Бизнес и т.п.). Формат:
 * { "reviews": [{ author, rating (1-5), text, date (YYYY-MM-DD),
 *                 city?, serviceSlug?, source }] }
 * city/serviceSlug опциональны: без них отзыв считается общим по компании.
 */
export interface RealReview {
  author: string;
  rating: number;
  text: string;
  date: string;
  city?: string;
  serviceSlug?: string;
  source?: string;
}

let cache: RealReview[] | null = null;

function load(): RealReview[] {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "real-reviews.json"), "utf8");
    const parsed = JSON.parse(raw) as { reviews?: RealReview[] };
    cache = (parsed.reviews || []).filter(
      (r) => r && typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 && r.author && r.text
    );
  } catch {
    cache = [];
  }
  return cache;
}

/** Отзывы, релевантные странице: точное совпадение по городу/услуге + общие. */
export function getRealReviews(city?: string, serviceSlug?: string): RealReview[] {
  const all = load();
  if (!all.length) return [];
  const c = (city || "").trim().toLowerCase();
  const s = (serviceSlug || "").trim().toLowerCase();
  return all.filter((r) => {
    const rc = (r.city || "").trim().toLowerCase();
    const rs = (r.serviceSlug || "").trim().toLowerCase();
    const cityOk = !rc || !c || rc === c;
    const svcOk = !rs || !s || rs === s;
    return cityOk && svcOk;
  });
}

export interface Aggregate {
  ratingValue: string;
  reviewCount: number;
}

/**
 * Агрегат для AggregateRating. null — если реальных отзывов нет.
 * MIN_REVIEWS: с одного отзыва агрегат бессмысленен и выглядит подозрительно.
 */
const MIN_REVIEWS = 3;

export function getRealAggregate(city?: string, serviceSlug?: string): Aggregate | null {
  const rs = getRealReviews(city, serviceSlug);
  if (rs.length < MIN_REVIEWS) return null;
  const avg = rs.reduce((a, r) => a + r.rating, 0) / rs.length;
  return { ratingValue: avg.toFixed(1), reviewCount: rs.length };
}
