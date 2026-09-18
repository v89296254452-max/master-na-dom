#!/usr/bin/env node
/**
 * ИИ-уникализация контента гео-страниц через OpenRouter (модели Claude).
 *
 * Запускать ЛОКАЛЬНО (с «чистого» IP — OpenRouter блокирует РФ-IP серверов).
 * Читает data/pages.csv, для каждого slug генерирует уникальный SEO-текст
 * и meta description, пишет в data/ai-content.json инкрементально.
 *
 * Возобновляемо: уже сгенерированные slug пропускаются.
 *
 * Использование:
 *   node scripts/generate-ai-content.mjs            # все страницы
 *   node scripts/generate-ai-content.mjs --limit 10 # пилот (первые 10 новых)
 *   node scripts/generate-ai-content.mjs --concurrency 4
 *
 * Ключ берётся из .env.generation (OPENROUTER_API_KEY/BASE_URL/MODEL).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PAGES_CSV = path.join(ROOT, "data", "pages.csv");
const OUT_JSON = path.join(ROOT, "data", "ai-content.json");

// ---- args ----
const args = process.argv.slice(2);
function argVal(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const LIMIT = parseInt(argVal("--limit", "0"), 10) || 0;
const CONCURRENCY = parseInt(argVal("--concurrency", "4"), 10) || 4;
const SOURCE = argVal("--source", "geo"); // "geo" | "problems" | "brand"
const PROBLEMS_CSV = path.join(ROOT, "data", "problems-cluster.csv");
const BRANDS_CSV = path.join(ROOT, "data", "brand-pages.csv");
// Шардирование: --shards N разбивает список на N непересекающихся частей по
// хешу slug, --shard R (0..N-1) выбирает свою. Позволяет гнать 2+ процесса
// (DeepSeek на сервере + OpenRouter на чистом IP) без дублей.
const SHARDS = parseInt(argVal("--shards", "1"), 10) || 1;
const SHARD = parseInt(argVal("--shard", "0"), 10) || 0;
function shardHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
const inShard = (slug) => SHARDS <= 1 || shardHash(slug) % SHARDS === SHARD;

// ---- env ----
// --env <file> позволяет указать альтернативный конфиг (для второго провайдера).
const ENV_FILE = argVal("--env", ".env.generation");
function loadEnv() {
  const p = path.join(ROOT, ENV_FILE);
  const env = {};
  try {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}
const ENV = loadEnv();
const API_KEY = ENV.OPENROUTER_API_KEY;
const BASE_URL = ENV.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const MODEL = ENV.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";
if (!API_KEY) {
  console.error("Нет OPENROUTER_API_KEY в .env.generation");
  process.exit(1);
}

// ---- CSV parse (RFC4180-ish, поддержка кавычек) ----
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseRecords(raw) {
  const records = [];
  let field = "", row = [], inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQ) {
      if (ch === '"') { if (raw[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); records.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* ignore */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); records.push(row); }
  return records;
}

function readPages() {
  const records = parseRecords(fs.readFileSync(PAGES_CSV, "utf8"));
  const header = records[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const iSlug = idx("slug"), iCity = idx("city"), iPrep = idx("cityPrepositional"),
        iService = idx("service"), iDistricts = idx("districts");
  return records.slice(1).filter((r) => r[iSlug]).map((r) => ({
    kind: "geo",
    slug: r[iSlug].trim(),
    city: (r[iCity] || "").trim(),
    cityPrep: (r[iPrep] || r[iCity] || "").trim(),
    service: (r[iService] || "").trim(),
    districts: (r[iDistricts] || "").trim(),
  }));
}

function readProblems() {
  const records = parseRecords(fs.readFileSync(PROBLEMS_CSV, "utf8"));
  const header = records[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const iSlug = idx("slug"), iService = idx("service"), iCity = idx("city"),
        iCityDat = idx("cityDat"), iProblem = idx("problem");
  return records.slice(1).filter((r) => r[iSlug]).map((r) => ({
    kind: "problem",
    slug: r[iSlug].trim(),
    service: (r[iService] || "").trim(),
    city: (r[iCity] || "").trim(),
    cityDat: (r[iCityDat] || r[iCity] || "").trim(),
    problem: (r[iProblem] || "").trim(),
  }));
}

function readBrands() {
  const records = parseRecords(fs.readFileSync(BRANDS_CSV, "utf8"));
  const header = records[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const iSlug = idx("slug"), iService = idx("service"), iBrand = idx("brand"),
        iCity = idx("city"), iCityDat = idx("cityDat");
  return records.slice(1).filter((r) => r[iSlug]).map((r) => ({
    kind: "brand",
    slug: r[iSlug].trim(),
    service: (r[iService] || "").trim(),
    brand: (r[iBrand] || "").trim(),
    city: (r[iCity] || "").trim(),
    cityDat: (r[iCityDat] || r[iCity] || "").trim(),
  }));
}

// ---- prompt ----
function buildBrandPrompt(p) {
  return `Ты — SEO-копирайтер сервиса вызова мастеров на дом «ПроМастер». Напиши УНИКАЛЬНЫЙ, экспертный текст для страницы «ремонт техники бренда ${p.brand}» по услуге «${p.service}» в городе ${p.city} (предложный падеж: «в ${p.cityDat}»).

Требования (6 абзацев):
- Раскрой специфику ремонта техники именно бренда ${p.brand}: характерные для ${p.brand} неисправности и слабые места, особенности запчастей и диагностики, почему нужен профильный мастер, что влияет на стоимость, как проходит ремонт на дому.
- Пиши экспертно, естественным языком, без воды и клише «качественно и недорого». Упоминай ${p.brand} органично.
- Учитывай город ${p.city}, где уместно, но без выдуманных адресов/телефонов/имён. Не пиши отзывы и точные цены.
- Текст должен заметно отличаться от страниц про другие бренды и другие города.

Верни СТРОГО валидный JSON без markdown:
{"description":"мета-описание 150-165 символов про ремонт ${p.brand} в ${p.cityDat}, с призывом","paragraphs":["абзац 1",...6 штук]}

Каждый абзац — 55-95 слов. Ровно 6 абзацев.`;
}

function buildPrompt(p) {
  return `Ты — SEO-копирайтер сервиса вызова мастеров на дом «ПроМастер». Напиши УНИКАЛЬНЫЙ, живой текст для страницы услуги «${p.service}» в городе ${p.city} (предложный падеж: «в ${p.cityPrep}»).

Районы города: ${p.districts || "—"}.

Требования:
- Пиши естественно, для людей, без воды и повторов, без канцелярита и клише «качественно и недорого».
- Учитывай местную специфику: районы, типичный жилой фонд (старый фонд/новостройки/частный сектор), сезонность, локальные особенности спроса именно для «${p.service}» в этом городе.
- НЕ выдумывай точные адреса, телефоны, названия ЖК и фамилии. Не пиши отзывы.
- Структура и формулировки должны заметно отличаться от текстов для других городов (не шаблон с подстановкой названия).
- Язык — русский.

Верни СТРОГО валидный JSON без markdown, вида:
{"description":"мета-описание 150-165 символов, с городом и услугой, призывом обратиться","paragraphs":["абзац 1","абзац 2","абзац 3","абзац 4","абзац 5","абзац 6"]}

Каждый абзац — 55-100 слов. Ровно 6 абзацев.`;
}

function buildProblemPrompt(p) {
  return `Ты — SEO-копирайтер сервиса вызова мастеров на дом «ПроМастер». Напиши УНИКАЛЬНЫЙ, экспертный текст для страницы про конкретную поломку.

Услуга: «${p.service}». Город: ${p.city} (предложный падеж: «в ${p.cityDat}»). Проблема: «${p.problem}».

Требования к тексту (6 абзацев):
- Раскрой ИМЕННО эту проблему «${p.problem}»: почему возникает (реальные технические причины), чем опасно затягивать, как мастер диагностирует и устраняет, что влияет на стоимость, когда точно нужен специалист, а когда можно проверить самому.
- Пиши экспертно и по делу, естественным языком, без воды и клише. Учитывай специфику города ${p.city}, где уместно.
- НЕ выдумывай точные цены, адреса, телефоны, имена. Не пиши отзывы.
- Текст должен заметно отличаться от страниц про эту же проблему в других городах.

Требования к FAQ (ровно 5 вопросов-ответов), СПЕЦИФИЧНЫХ для проблемы «${p.problem}» (не общие «даёте ли гарантию»): реальные вопросы, которые задают люди с этой поломкой, с полезными ответами на 1-3 предложения.

Верни СТРОГО валидный JSON без markdown:
{"description":"мета-описание 150-165 символов про «${p.problem}» в ${p.cityDat}, с призывом","paragraphs":["абзац 1",...6 штук],"faqs":[{"question":"...","answer":"..."},...5 штук]}

Каждый абзац — 55-95 слов.`;
}

async function generateOne(p, attempt = 1) {
  const isProblem = p.kind === "problem";
  const prompt = isProblem ? buildProblemPrompt(p) : p.kind === "brand" ? buildBrandPrompt(p) : buildPrompt(p);
  let res;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://master-na-dom.online",
        "X-Title": "ProMaster content",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: isProblem ? 0.7 : 0.8,
        max_tokens: isProblem ? 4000 : 1600,
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    // сетевые сбои (fetch failed) — тоже ретраим с backoff
    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, 3000 * attempt));
      return generateOne(p, attempt + 1);
    }
    throw e;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 403 «security policy» = анти-абузный троттлинг провайдера: ждём дольше.
    const retryable = res.status === 429 || res.status === 403 || res.status >= 500;
    if (retryable && attempt < 6) {
      const backoff = res.status === 403 ? 15000 * attempt : 2000 * attempt;
      await new Promise((r) => setTimeout(r, backoff));
      return generateOne(p, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const maxAttempts = isProblem ? 5 : 3;
  // Чистим сырые управляющие символы (незаэкранированные переносы строк
  // внутри строковых значений — частая причина невалидного JSON).
  function stripControls(str) {
    let out = "";
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      out += c < 32 ? " " : str[i];
    }
    return out;
  }
  function tryParse(str) {
    const cleaned = stripControls(str);
    try { return JSON.parse(cleaned); } catch {}
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
  const parsed = tryParse(content);
  if (!parsed || !Array.isArray(parsed.paragraphs) || parsed.paragraphs.length < 4) {
    if (attempt < maxAttempts) return generateOne(p, attempt + 1);
    throw new Error("Плохой JSON от модели");
  }
  // Лёгкая чистка артефактов модели: markdown-символы, латинские вставки в
  // словах, двойные пробелы.
  const cleanText = (s) =>
    String(s)
      .replace(/[`*#_]+/g, "")
      .replace(/\b(major|premium|standard|basic)-/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  const out = {
    description: typeof parsed.description === "string" ? cleanText(parsed.description) : undefined,
    paragraphs: parsed.paragraphs.map((s) => cleanText(s)).filter(Boolean),
  };
  if (isProblem) {
    const faqs = Array.isArray(parsed.faqs)
      ? parsed.faqs
          .filter((f) => f && f.question && f.answer)
          .map((f) => ({ question: cleanText(f.question), answer: cleanText(f.answer) }))
      : [];
    if (faqs.length < 3) {
      if (attempt < 3) return generateOne(p, attempt + 1);
    }
    out.faqs = faqs;
  }
  return out;
}

// ---- main ----
// --out: отдельный файл вывода (чтобы гнать 2 источника параллельно без гонки
// за один файл). База (главный ai-content.json) читается только для isDone.
const OUT_PATH = argVal("--out", OUT_JSON);
function loadStore(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return {}; }
}
function saveStore(store) {
  fs.writeFileSync(OUT_PATH, JSON.stringify(store, null, 0));
}

async function main() {
  const pages = SOURCE === "problems" ? readProblems() : SOURCE === "brand" ? readBrands() : readPages();
  const store = loadStore(OUT_PATH);
  const base = OUT_PATH === OUT_JSON ? store : loadStore(OUT_JSON);
  const doneEntry = (e) => e && (SOURCE !== "problems" || (Array.isArray(e.faqs) && e.faqs.length > 0));
  // готово, если есть в своём файле ИЛИ в главной базе
  const isDone = (slug) => doneEntry(store[slug]) || doneEntry(base[slug]);
  let todo = pages.filter((p) => inShard(p.slug) && !isDone(p.slug));
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);

  const shardTag = SHARDS > 1 ? ` [шард ${SHARD}/${SHARDS}]` : "";
  console.log(`Источник: ${SOURCE}${shardTag}. Всего: ${pages.length}, к генерации: ${todo.length} (модель ${MODEL} @ ${BASE_URL})`);
  if (todo.length === 0) return;

  // Пул воркеров: как только слот освобождается — берём следующую задачу.
  // Сохраняем стор пачками (каждые SAVE_EVERY успехов), чтобы не писать
  // большой JSON на каждый ответ.
  let done = 0, failed = 0, next = 0, sinceSave = 0;
  const SAVE_EVERY = 25;

  async function worker() {
    while (next < todo.length) {
      const p = todo[next++];
      try {
        store[p.slug] = await generateOne(p);
        done++;
      } catch (e) {
        failed++;
        console.error(`  ✗ ${p.slug}: ${e.message}`);
      }
      if (++sinceSave >= SAVE_EVERY) { saveStore(store); sinceSave = 0; }
      process.stdout.write(`\r  прогресс: ${done} ок, ${failed} ошибок, осталось ${todo.length - done - failed}   `);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  saveStore(store);
  console.log(`\nГотово. Успешно: ${done}, ошибок: ${failed}. Итого в базе: ${Object.keys(store).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
