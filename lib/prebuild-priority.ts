import fs from "fs";
import path from "path";

/**
 * Whitelist слагов для частичного generateStaticParams на трёх полностью
 * on-demand роутах (/[slug], /problem/[slug], /problem-service/[slug]).
 *
 * Цель — устранить cold-start штраф (первый рендер = SQLite + FAQ/цены +
 * JSON-LD, десятки-сотни мс, см. docs/PRODUCTION-MEMORY-AUDIT.md) именно
 * для приоритетных «денежных» страниц, НЕ прогревая все 50k+ URL при билде.
 *
 * Источник приоритета — data/prebuild-priority.json. Пока реальных данных
 * по трафику/позициям нет, файл содержит пустые массивы (см. Этап 21
 * SEO-аудита — оттуда позже придёт настоящий приоритет). Пустой список =
 * generateStaticParams возвращает [] = точное текущее поведение (полностью
 * on-demand), это безопасный дефолт.
 *
 * Жёсткие пределы (даже если в JSON окажется больше — не билдим сверх):
 * не ради экономии памяти билда как таковой, а чтобы случайно не утащить
 * сборку в те же полчаса-часы, которые уже были проблемой для cold-start
 * рантайма — cold-start билда ничем не лучше.
 */
const LIMITS = {
  brandPages: 300,
  problemPages: 300,
  problemServicePages: 400,
} as const;

export interface PrebuildPriority {
  brandPages: string[];
  problemPages: string[];
  problemServicePages: string[];
}

const EMPTY: PrebuildPriority = { brandPages: [], problemPages: [], problemServicePages: [] };

let cache: PrebuildPriority | null = null;

function clampList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, limit);
}

/** Читает и валидирует data/prebuild-priority.json. Отсутствие/битый файл — безопасный [] (полностью on-demand), не падение билда. */
export function getPrebuildPriority(): PrebuildPriority {
  if (cache) return cache;
  const p = path.join(process.cwd(), "data", "prebuild-priority.json");
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<PrebuildPriority>;
    cache = {
      brandPages: clampList(raw.brandPages, LIMITS.brandPages),
      problemPages: clampList(raw.problemPages, LIMITS.problemPages),
      problemServicePages: clampList(raw.problemServicePages, LIMITS.problemServicePages),
    };
  } catch {
    cache = EMPTY;
  }
  return cache;
}
