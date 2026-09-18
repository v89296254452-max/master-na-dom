import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

/**
 * Хранилище ИИ-сгенерированного уникального контента страниц (гео/проблемные/бренды).
 *
 * Раньше читалось из монолитного data/ai-content.json целиком в память. При 90k+
 * страниц файл раздулся до 550 МБ и:
 *   - превысил лимит длины строки V8 (512 МБ) → readFileSync падал;
 *   - даже 238 МБ парс в рантайме Next упирался в heap → JSON.parse падал → весь
 *     контент отдавался фолбэком.
 *
 * Теперь контент лежит в SQLite (data/ai-content.db, таблица content(slug,data)),
 * запрос идёт по одному slug — без гигантского парса, память минимальна, масштаб
 * не ограничен. Сборка БД: scripts/build-ai-content-db.mjs.
 *
 * Fallback: если БД нет (локальная разработка/свежий клон), читаем старый
 * ai-content.json как раньше — поэтому переход безопасен.
 */

export interface AiFaq {
  question: string;
  answer: string;
}

export interface AiPageContent {
  description?: string;
  paragraphs: string[];
  faqs?: AiFaq[];
}

const DB_PATH = path.join(process.cwd(), "data", "ai-content.db");
const JSON_PATH = path.join(process.cwd(), "data", "ai-content.json");

let db: Database.Database | null | undefined; // undefined = не пробовали, null = нет БД
let stmt: Database.Statement | null = null;
let jsonCache: Record<string, AiPageContent> | null = null;
// Небольшой LRU-подобный кэш горячих slug'ов, чтобы не дёргать БД повторно.
const hot = new Map<string, AiPageContent | null>();
const HOT_MAX = 2000;

function getDb(): Database.Database | null {
  if (db !== undefined) return db;
  try {
    if (!fs.existsSync(DB_PATH)) {
      db = null;
    } else {
      db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
      db.pragma("journal_mode = WAL");
      stmt = db.prepare("SELECT data FROM content WHERE slug = ?");
    }
  } catch {
    db = null;
  }
  return db;
}

/** Fallback-загрузка старого JSON (только если БД отсутствует).
 *  Fail-safe: НЕ парсим гигантский файл (>400 МБ близко к лимиту строки V8 и
 *  вызывает OOM в проде) — лучше пустой контент (страницы упадут на шаблон),
 *  чем падение процесса. БД должна существовать всегда (см. start-prod.sh). */
const MAX_JSON_FALLBACK_BYTES = 400 * 1024 * 1024;
function loadJson(): Record<string, AiPageContent> {
  if (jsonCache) return jsonCache;
  try {
    const size = fs.statSync(JSON_PATH).size;
    if (size > MAX_JSON_FALLBACK_BYTES) {
      console.error(
        `[ai-content] БД ${DB_PATH} отсутствует, а JSON-fallback ${JSON_PATH} = ${Math.round(size / 1e6)}МБ ` +
          `(>${MAX_JSON_FALLBACK_BYTES / 1e6}МБ) — парс пропущен во избежание OOM. Соберите БД: node scripts/build-ai-content-db.mjs`
      );
      jsonCache = {};
      return jsonCache;
    }
    console.warn(`[ai-content] БД нет — читаю JSON-fallback ${JSON_PATH} (${Math.round(size / 1e6)}МБ)`);
    jsonCache = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as Record<string, AiPageContent>;
  } catch {
    jsonCache = {};
  }
  return jsonCache;
}

// Множество slug'ов с готовым уникальным текстом — для гейта index/sitemap
// БЕЗ 86k отдельных запросов. В БД лежат только записи с paragraphs>=4, поэтому
// весь набор ключей = индексируемые страницы. Одна выборка, мемоизируется.
let indexableSet: Set<string> | null = null;
export function getIndexableSlugSet(): Set<string> {
  if (indexableSet) return indexableSet;
  const database = getDb();
  if (database) {
    const rows = database.prepare("SELECT slug FROM content").all() as { slug: string }[];
    indexableSet = new Set(rows.map((r) => r.slug));
  } else {
    const json = loadJson();
    indexableSet = new Set(
      Object.keys(json).filter((k) => {
        const e = json[k];
        return Array.isArray(e?.paragraphs) && e.paragraphs.length >= 4;
      })
    );
  }
  return indexableSet;
}

function lookup(slug: string): AiPageContent | null {
  if (hot.has(slug)) return hot.get(slug) ?? null;

  let entry: AiPageContent | null = null;
  const database = getDb();
  if (database && stmt) {
    const row = stmt.get(slug) as { data: string } | undefined;
    if (row?.data) {
      try {
        entry = JSON.parse(row.data) as AiPageContent;
      } catch {
        entry = null;
      }
    }
  } else {
    entry = loadJson()[slug] ?? null;
  }

  if (hot.size >= HOT_MAX) hot.clear(); // простой сброс при переполнении
  hot.set(slug, entry);
  return entry;
}

/** Уникальный ИИ-контент для slug или null, если ещё не сгенерирован. */
export function getAiContent(slug: string | undefined): AiPageContent | null {
  if (!slug) return null;
  const entry = lookup(slug);
  if (!entry || !Array.isArray(entry.paragraphs) || entry.paragraphs.length === 0) {
    return null;
  }
  return entry;
}

/** Уникальные ИИ-FAQ для slug (или null). */
export function getAiFaqs(slug: string | undefined): AiFaq[] | null {
  const entry = getAiContent(slug);
  if (!entry?.faqs || entry.faqs.length === 0) return null;
  return entry.faqs;
}
