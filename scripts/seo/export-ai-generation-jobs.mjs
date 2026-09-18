#!/usr/bin/env node
/**
 * Готовит задания для ЛОКАЛЬНОЙ генерации уникального текста для 30
 * experimental noindex-страниц (reports/noindex-experiment.csv, group=
 * EXPERIMENTAL). Не вызывает никакой LLM сам — только собирает реальные
 * данные страницы (title/H1/цены/FAQ/районы — то же, что уже есть в
 * data/pages.csv) и формирует promt по структуре из ТЗ
 * (INTRO/TYPES OF WORK/LOCAL/PROCESS).
 *
 * Никаких секретов/API-ключей в выходной файл не пишет.
 *
 *   node scripts/seo/export-ai-generation-jobs.mjs
 *
 * Пишет data/seo/noindex-experiment-jobs.json.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length === header.length).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i]]))
  );
}

const experiment = parseCsv(fs.readFileSync(path.join(ROOT, "reports/noindex-experiment.csv"), "utf-8"))
  .filter((r) => r.group === "EXPERIMENTAL");

const pagesRows = parseCsv(fs.readFileSync(path.join(ROOT, "data/pages.csv"), "utf-8"));
const pagesBySlug = new Map(pagesRows.map((r) => [r.slug, r]));

function slugFromUrl(url) {
  return url.replace(/^https:\/\/master-na-dom\.online\//, "").replace(/\/$/, "");
}

// Разрешённые виды работ по услуге — ТОЛЬКО то, что реально указано в
// data/pages.csv (price1..price4) для этого конкретного slug. Ничего не
// добавляем от себя (особенно для Дезинфекции — не придумываем
// лицензируемые/опасные виды работ, которых нет в данных партнёра).
function extractPrices(row) {
  const out = [];
  for (let i = 1; i <= 4; i++) {
    const v = row[`price${i}`];
    if (v) out.push(v);
  }
  return out;
}
function extractFaqs(row) {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const q = row[`faq${i}q`], a = row[`faq${i}a`];
    if (q && a) out.push({ question: q, answer: a });
  }
  return out;
}

const BLACKLIST_NOTE =
  "НЕ используй: население города, историю города, климат, циклоны, реки, " +
  "географическое положение/площадь — ничего из этого не помогает заказать " +
  "услугу. Локализация — только через районы/формат выезда/типовые объекты " +
  "(квартиры, офисы, дома).";

function buildPrompt(row) {
  const { service, city, cityPrepositional: cityDat, h1, title } = row;
  const prices = extractPrices(row);
  const faqs = extractFaqs(row);
  const districts = row.districts || "";
  return [
    `Напиши уникальный SEO-текст для коммерческой страницы услуги "${service}" в городе ${city} (сайт мастеров на дом, оплата после работ, диагностика/выезд бесплатно при заказе).`,
    ``,
    `Текущий H1 страницы: "${h1 || title}". Не меняй суть услуги/города.`,
    ``,
    `Структура — ровно 4 самостоятельных абзаца:`,
    `1. INTRO (60-120 слов): услуга + город + формат работы (выезд на дом) + основная потребность пользователя. Без принудительного набивания ключевых слов.`,
    `2. TYPES OF WORK: перечисли виды работ ТОЛЬКО из этого списка (не добавляй ничего от себя, особенно не придумывай опасные/лицензируемые виды работ): ${prices.length ? prices.join("; ") : "(нет данных о ценах для этой страницы — опиши услугу в целом, не придумывай конкретные виды работ)"}`,
    `3. LOCAL BLOCK: районы/зона выезда (${districts || "данных о районах нет — опиши формат выезда по городу в целом"}), формат объектов (квартиры/дома/офисы). НЕ упоминай население/историю/климат/реки/площадь города.`,
    `4. PROCESS: реальный процесс — заявка → уточнение задачи → согласование → выезд → выполнение → приёмка. НЕ придумывай цифры/обещания, которых нет в данных (конкретное время выезда, число мастеров, срок гарантии) — если это не указано ниже, не упоминай.`,
    ``,
    `Справочные FAQ этой страницы (для контекста, не дублируй дословно в абзацах):`,
    ...faqs.map((f) => `- ${f.question} ${f.answer}`),
    ``,
    BLACKLIST_NOTE,
    ``,
    `Верни JSON: {"paragraphs": ["абзац1", "абзац2", "абзац3", "абзац4"]} — ровно 4 строки, каждая — самостоятельный абзац без заголовков внутри текста.`,
  ].join("\n");
}

const jobs = [];
const missing = [];
for (const exp of experiment) {
  const slug = slugFromUrl(exp.URL);
  const row = pagesBySlug.get(slug);
  if (!row) { missing.push(slug); continue; }
  jobs.push({
    slug,
    city: row.city,
    service: row.service,
    existingTitle: row.title,
    existingH1: row.h1,
    prices: extractPrices(row),
    faqs: extractFaqs(row),
    districts: row.districts || "",
    prompt: buildPrompt(row),
  });
}

fs.mkdirSync(path.join(ROOT, "data/seo"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "data/seo/noindex-experiment-jobs.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), count: jobs.length, jobs }, null, 2),
  "utf-8"
);

console.log(`Jobs written: ${jobs.length}`);
if (missing.length) console.log(`WARNING - slugs not found in pages.csv: ${missing.join(", ")}`);
console.log(`Output: data/seo/noindex-experiment-jobs.json`);
console.log(`\nNo API keys or secrets included. Run generation locally, then:`);
console.log(`  node scripts/seo/import-ai-generation-results.mjs --file=<your-output.json> --dry-run`);
