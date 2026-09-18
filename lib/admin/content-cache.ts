import fs from "fs";
import path from "path";

/**
 * Общий кэш «тяжёлого» контента для админки.
 *
 * Проблема: ai-content.brand.json ~225 МБ. Парсить его на каждый запрос
 * /api/admin/stats и /api/admin/pages = 6-7с + ~1 ГБ памяти на парс; при
 * параллельных запросах сервер уходит в OOM (502), а если файл читается в
 * момент записи генерацией — JSON.parse рвётся на неполном файле.
 *
 * Решение: парсим все три файла ОДИН раз, держим в памяти только лёгкий
 * индекс — Set slug'ов с готовым ИИ-текстом (>=4 абзаца). Сырой контент
 * (225 МБ параграфов) сразу выбрасываем — он админке не нужен. Параллельные
 * запросы ждут один общий парс (in-flight dedup), а не плодят свои.
 */

const ROOT = process.cwd();
const FILES = ["data/ai-content.json", "data/ai-content.brand.json", "data/ai-content.problems.json"];

interface ContentIndex {
  /** slug'и, у которых есть готовый ИИ-текст (paragraphs.length >= 4). */
  indexedSlugs: Set<string>;
  builtAt: number;
}

const TTL_MS = 60_000; // пере-парсить не чаще раза в минуту (во время генерации счётчики чуть отстают — это ок)
let cache: ContentIndex | null = null;
let inFlight: Promise<ContentIndex> | null = null;

/** Читает один JSON-файл устойчиво: если попали на недописанный файл — пара ретраев. */
function readJsonResilient(file: string): Record<string, { paragraphs?: string[] }> {
  const p = path.join(ROOT, file);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = fs.readFileSync(p, "utf8");
      return JSON.parse(raw);
    } catch {
      // недописанный файл или его нет — маленькая пауза и ретрай (синхронно)
      const until = Date.now() + 150;
      while (Date.now() < until) { /* busy-wait 150мс */ }
    }
  }
  return {};
}

function build(): ContentIndex {
  const indexedSlugs = new Set<string>();
  for (const file of FILES) {
    const data = readJsonResilient(file);
    for (const slug in data) {
      const e = data[slug];
      if (e && Array.isArray(e.paragraphs) && e.paragraphs.length >= 4) {
        indexedSlugs.add(slug);
      }
    }
    // важно: не держим ссылку на data — пусть GC освободит 225 МБ до парса следующего файла
  }
  return { indexedSlugs, builtAt: Date.now() };
}

/** Вернуть индекс из кэша; при устаревании перестроить (с дедупом параллельных вызовов). */
export async function getContentIndex(): Promise<ContentIndex> {
  if (cache && Date.now() - cache.builtAt < TTL_MS) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      cache = build();
      return cache;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Сбросить кэш принудительно (после мержа/деплоя нового контента). */
export function invalidateContentIndex(): void {
  cache = null;
}
