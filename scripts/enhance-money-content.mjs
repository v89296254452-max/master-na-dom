#!/usr/bin/env node
/**
 * Углубление контента money-страниц (топ-города × услуги): переписывает текст
 * на более глубокий и экспертный (8 абзацев, 600-800 слов) вместо базовых ~300.
 * Цель — усилить конкурентные страницы, где есть реальный спрос.
 *
 * Пишет в data/ai-content.money.json (отдельный файл). Затем build-ai-content-db
 * подхватывает его ПОСЛЕДНИМ и перекрывает базовые записи (INSERT OR REPLACE).
 *
 * Запуск: node scripts/enhance-money-content.mjs [--limit N] [--concurrency 5]
 * Возобновляемо: готовые slug пропускаются.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const PAGES_CSV = path.join(ROOT, "data", "pages.csv");
const OUT = path.join(ROOT, "data", "ai-content.money.json");

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LIMIT = parseInt(argVal("--limit", "0"), 10) || 0;
const CONCURRENCY = parseInt(argVal("--concurrency", "5"), 10) || 5;

// креды
function loadEnv() {
  const env = {};
  try { for (const l of fs.readFileSync(path.join(ROOT, ".env.generation"), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); } } catch {}
  return env;
}
const E = loadEnv();
const API_KEY = E.OPENROUTER_API_KEY;
const BASE_URL = E.OPENROUTER_BASE_URL || "https://api.deepseek.com";
const MODEL = E.OPENROUTER_MODEL || "deepseek-chat";
if (!API_KEY) { console.error("Нет OPENROUTER_API_KEY"); process.exit(1); }

const TOP_CITIES = new Set([
  "Москва","Санкт-Петербург","Новосибирск","Екатеринбург","Казань","Нижний Новгород",
  "Челябинск","Самара","Уфа","Ростов-на-Дону","Краснодар","Омск","Воронеж","Пермь",
  "Волгоград","Красноярск","Саратов","Тюмень","Тольятти","Ижевск","Барнаул","Ульяновск",
  "Иркутск","Хабаровск","Ярославль","Владивосток","Махачкала","Томск","Оренбург","Кемерово",
  "Новокузнецк","Рязань","Астрахань","Набережные Челны","Пенза","Липецк","Киров","Чебоксары","Тула","Калининград",
]);

// ---- CSV ----
function parseRecords(raw) {
  const rec = []; let f = "", row = [], q = false;
  for (let i = 0; i < raw.length; i++) { const ch = raw[i];
    if (q) { if (ch === '"') { if (raw[i+1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else { if (ch === '"') q = true; else if (ch === ",") { row.push(f); f = ""; } else if (ch === "\n") { row.push(f); rec.push(row); row = []; f = ""; } else if (ch === "\r") {} else f += ch; } }
  if (f.length || row.length) { row.push(f); rec.push(row); }
  return rec;
}
function readMoneyPages() {
  const rec = parseRecords(fs.readFileSync(PAGES_CSV, "utf8"));
  const h = rec[0].map((x) => x.trim());
  const idx = (n) => h.indexOf(n);
  const iSlug = idx("slug"), iCity = idx("city"), iPrep = idx("cityPrepositional"), iSvc = idx("service"), iDist = idx("districts");
  return rec.slice(1).filter((r) => r[iSlug] && TOP_CITIES.has((r[iCity] || "").trim())).map((r) => ({
    slug: r[iSlug].trim(), city: (r[iCity] || "").trim(),
    cityPrep: (r[iPrep] || r[iCity] || "").trim(), service: (r[iSvc] || "").trim(),
    districts: (r[iDist] || "").trim(),
  }));
}

function buildPrompt(p) {
  return `Ты — практикующий инженер сервисной службы «ПроМастер» с 12-летним опытом. Напиши УНИКАЛЬНЫЙ, глубокий, экспертный текст для страницы услуги «${p.service}» в городе ${p.city} (предложный: «в ${p.cityPrep}»). Районы: ${p.districts || "—"}.

Это конкурентная коммерческая страница — нужен серьёзный объём и польза, а не общие слова.

Структура — РОВНО 8 абзацев, каждый 70-115 слов:
1. Живое вступление под запрос «${p.service} ${p.city}»: боль клиента + чем помогаем, локальный контекст города.
2. Типичные неисправности/ситуации именно по услуге «${p.service}» — конкретика, техника, симптомы (что и почему ломается).
3. Ещё частые случаи + к чему приводит промедление (риски, если тянуть).
4. Как работает мастер: диагностика, этапы, инструмент, запчасти — по-настоящему, по делу.
5. Что влияет на стоимость — честно, факторы цены (без выдуманных цифр), почему нельзя назвать точную цену заранее.
6. Локальная специфика ${p.city}: районы, тип жилфонда (старый фонд/новостройки/частный сектор), климат/вода/сезонность — как это влияет на «${p.service}».
7. Что можно проверить самому до вызова, а когда точно нужен специалист (полезные практические советы — экспертность).
8. Гарантии, оплата после работ, почему выбирают нас — без пафоса и клише.

Требования: пиши для людей, живым языком, без воды и штампов «качественно и недорого». НЕ выдумывай адреса, телефоны, названия ЖК, фамилии, точные цены, отзывы. Текст должен заметно отличаться от других городов.

Верни СТРОГО валидный JSON без markdown:
{"description":"мета-описание 150-165 символов с городом, услугой и призывом","paragraphs":["...8 абзацев..."]}`;
}

async function generateOne(p, attempt = 1) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: buildPrompt(p) }], temperature: 0.8, max_tokens: 2600, response_format: { type: "json_object" } }),
    });
  } catch (e) { if (attempt < 6) { await new Promise((r) => setTimeout(r, 3000 * attempt)); return generateOne(p, attempt + 1); } throw e; }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const retry = res.status === 429 || res.status === 403 || res.status >= 500;
    if (retry && attempt < 6) { await new Promise((r) => setTimeout(r, (res.status === 403 ? 15000 : 2000) * attempt)); return generateOne(p, attempt + 1); }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 150)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const strip = (s) => { let o = ""; for (let i = 0; i < s.length; i++) o += s.charCodeAt(i) < 32 ? " " : s[i]; return o; };
  let parsed = null;
  try { parsed = JSON.parse(strip(content)); } catch { const m = strip(content).match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
  if (!parsed || !Array.isArray(parsed.paragraphs) || parsed.paragraphs.length < 6) {
    if (attempt < 4) return generateOne(p, attempt + 1);
    throw new Error("Плохой JSON");
  }
  const clean = (s) => String(s).replace(/[`*#_]+/g, "").replace(/\s{2,}/g, " ").trim();
  return { description: typeof parsed.description === "string" ? clean(parsed.description) : undefined, paragraphs: parsed.paragraphs.map(clean).filter(Boolean) };
}

async function main() {
  const pages = readMoneyPages();
  let store = {};
  try { store = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
  let todo = pages.filter((p) => !store[p.slug]);
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);
  console.log(`Money-страниц: ${pages.length}, к углублению: ${todo.length} (модель ${MODEL})`);
  if (!todo.length) return;

  let done = 0, failed = 0, next = 0, sinceSave = 0;
  const save = () => fs.writeFileSync(OUT, JSON.stringify(store, null, 0));
  async function worker() {
    while (next < todo.length) {
      const p = todo[next++];
      try { store[p.slug] = await generateOne(p); done++; }
      catch (e) { failed++; console.error(`\n  ✗ ${p.slug}: ${e.message}`); }
      if (++sinceSave >= 20) { save(); sinceSave = 0; }
      process.stdout.write(`\r  прогресс: ${done} ок, ${failed} ошибок, осталось ${todo.length - done - failed}   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  save();
  console.log(`\nГотово. Успешно: ${done}, ошибок: ${failed}. В money-файле: ${Object.keys(store).length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
