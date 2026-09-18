#!/usr/bin/env node
/**
 * LONGTAIL: регенерация problem-service страниц (город × услуга × поломка) с
 * привязкой к РЕАЛЬНЫМ фактам города (city-facts.json) + специфике поломки.
 * Приоритет по спросу: топ-города первыми, затем остальные города с фактами.
 *
 * Пишет в data/ai-content.problems-facts.json (перекрывает базовые при сборке БД).
 * Чекпойнт: страницы с маркером _facts пропускаются.
 *
 * Запуск: node scripts/regen-problems-facts.mjs [--limit N] [--concurrency 6] [--top-only]
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CSV = path.join(ROOT, "data", "problems-cluster.csv");
const FACTS = path.join(ROOT, "data", "city-facts.json");
const OUT = path.join(ROOT, "data", "ai-content.problems-facts.json");

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LIMIT = parseInt(argVal("--limit", "0"), 10) || 0;
const CONC = parseInt(argVal("--concurrency", "6"), 10) || 6;
const TOP_ONLY = args.includes("--top-only");

function env() { const e = {}; try { for (const l of fs.readFileSync(path.join(ROOT, ".env.generation"), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) e[m[1]] = m[2].trim(); } } catch {} return e; }
const E = env();
const KEY = E.OPENROUTER_API_KEY, BASE = E.OPENROUTER_BASE_URL || "https://api.deepseek.com", MODEL = E.OPENROUTER_MODEL || "deepseek-chat";
if (!KEY) { console.error("нет ключа"); process.exit(1); }

const TOP = new Set(["Москва","Санкт-Петербург","Новосибирск","Екатеринбург","Казань","Нижний Новгород","Челябинск","Самара","Уфа","Ростов-на-Дону","Краснодар","Омск","Воронеж","Пермь","Волгоград","Красноярск","Саратов","Тюмень","Тольятти","Ижевск","Барнаул","Ульяновск","Иркутск","Хабаровск","Ярославль","Владивосток","Махачкала","Томск","Оренбург","Кемерово","Новокузнецк","Рязань","Астрахань","Пенза","Липецк","Киров","Чебоксары","Тула","Калининград","Сочи"]);

function parseRecords(raw) {
  const rec = []; let f = "", row = [], q = false;
  for (let i = 0; i < raw.length; i++) { const ch = raw[i];
    if (q) { if (ch === '"') { if (raw[i+1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else { if (ch === '"') q = true; else if (ch === ",") { row.push(f); f = ""; } else if (ch === "\n") { row.push(f); rec.push(row); row = []; f = ""; } else if (ch === "\r") {} else f += ch; } }
  if (f.length || row.length) { row.push(f); rec.push(row); }
  return rec;
}

const facts = (() => { try { const j = JSON.parse(fs.readFileSync(FACTS, "utf8")); const m = new Map(); for (const k in j) if (j[k]?.city) m.set(j[k].city.trim().toLowerCase(), j[k]); return m; } catch { return new Map(); } })();

function pages() {
  const rec = parseRecords(fs.readFileSync(CSV, "utf8"));
  const h = rec[0].map(x => x.trim()); const idx = n => h.indexOf(n);
  const iS = idx("slug"), iSv = idx("service"), iC = idx("city"), iCd = idx("cityDat"), iP = idx("problem");
  const tier = { "миллионник": 0, "крупный": 1, "средний": 2, "малый": 3 };
  const out = rec.slice(1).filter(r => {
    if (!r[iS]) return false;
    const c = (r[iC] || "").trim();
    if (TOP_ONLY) return TOP.has(c);
    return TOP.has(c) || (facts.get(c.toLowerCase())?.districts?.length > 0);
  }).map(r => ({
    slug: r[iS].trim(), service: (r[iSv] || "").trim(), city: (r[iC] || "").trim(),
    cityDat: (r[iCd] || r[iC] || "").trim(), problem: (r[iP] || "").trim(),
  }));
  // топ-города первыми, потом по размеру
  out.sort((a, b) => {
    const at = TOP.has(a.city) ? -1 : (tier[facts.get(a.city.toLowerCase())?.population_tier] ?? 2);
    const bt = TOP.has(b.city) ? -1 : (tier[facts.get(b.city.toLowerCase())?.population_tier] ?? 2);
    return at - bt;
  });
  return out;
}

function prompt(p) {
  const f = facts.get(p.city.toLowerCase()) || {};
  const known = [];
  if (f.districts?.length) known.push(`Районы: ${f.districts.slice(0, 6).join(", ")}.`);
  if (f.housing) known.push(`Застройка: ${f.housing}.`);
  if (f.water_hardness) known.push(`Вода: ${f.water_hardness}.`);
  if (f.climate_note) known.push(`Климат: ${f.climate_note}.`);
  const fb = known.length ? known.join("\n") : "(проверенных локальных фактов нет — не выдумывай их)";
  return `Ты — практикующий мастер сервиса «ПроМастер». Напиши УНИКАЛЬНЫЙ экспертный текст для страницы про КОНКРЕТНУЮ поломку.

Услуга: «${p.service}». Город: ${p.city} (предложный: «в ${p.cityDat}»). Поломка: «${p.problem}».

РЕАЛЬНЫЕ ФАКТЫ О ГОРОДЕ (используй, где они действительно влияют на эту поломку; НЕ выдумывай сверх):
${fb}

Требования:
- paragraphs: 6 абзацев, 1500-2500 знаков суммарно. Раскрой ИМЕННО поломку «${p.problem}»: как проявляется, реальные технические причины, чем опасно тянуть, как мастер диагностирует и чинит, что влияет на стоимость, что можно проверить самому.
- Там, где уместно, свяжи с местными условиями (жёсткость воды / климат / тип жилфонда) — это должно быть по делу, а не для галочки.
- Название города — 2-3 раза на весь текст, без переспама. Без выдуманных цен/адресов/имён/отзывов. Без клише.
- faqs: ровно 5 вопросов-ответов, СПЕЦИФИЧНЫХ для поломки «${p.problem}» (не общие «даёте ли гарантию»), ответы 1-3 предложения.

Верни строго JSON без markdown:
{"description":"мета 150-165 символов про «${p.problem}» в ${p.cityDat}, с призывом","paragraphs":["...6 абзацев..."],"faqs":[{"question":"...","answer":"..."}]}`;
}

async function one(p, attempt = 1) {
  let res;
  try { res = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt(p) }], temperature: 0.8, max_tokens: 3000, response_format: { type: "json_object" } }) }); }
  catch (e) { if (attempt < 5) { await new Promise(r => setTimeout(r, 2500 * attempt)); return one(p, attempt + 1); } throw e; }
  if (!res.ok) { if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < 5) { await new Promise(r => setTimeout(r, (res.status === 403 ? 12000 : 2000) * attempt)); return one(p, attempt + 1); } throw new Error("HTTP " + res.status); }
  const d = await res.json(); const c = d.choices?.[0]?.message?.content || "";
  const strip = s => { let o = ""; for (let i = 0; i < s.length; i++) o += s.charCodeAt(i) < 32 ? " " : s[i]; return o; };
  let pr = null; try { pr = JSON.parse(strip(c)); } catch { const m = strip(c).match(/\{[\s\S]*\}/); if (m) try { pr = JSON.parse(m[0]); } catch {} }
  if (!pr || !Array.isArray(pr.paragraphs) || pr.paragraphs.length < 5) { if (attempt < 4) return one(p, attempt + 1); throw new Error("bad json"); }
  const clean = s => String(s).replace(/[`*#_]+/g, "").replace(/\s{2,}/g, " ").trim();
  const faqs = Array.isArray(pr.faqs) ? pr.faqs.filter(f => f?.question && f?.answer).map(f => ({ question: clean(f.question), answer: clean(f.answer) })) : [];
  if (faqs.length < 3 && attempt < 3) return one(p, attempt + 1);
  return { description: typeof pr.description === "string" ? clean(pr.description) : undefined, paragraphs: pr.paragraphs.map(clean).filter(Boolean), faqs, _facts: true };
}

async function main() {
  const list = pages();
  let store = {}; try { store = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
  let todo = list.filter(p => !store[p.slug]?._facts);
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);
  console.log(`problem-service в выборке: ${list.length}, к регенерации: ${todo.length} (модель ${MODEL})`);
  if (!todo.length) return;
  let done = 0, failed = 0, next = 0, since = 0;
  const save = () => fs.writeFileSync(OUT, JSON.stringify(store, null, 0));
  async function worker() {
    while (next < todo.length) {
      const p = todo[next++];
      try { store[p.slug] = await one(p); done++; }
      catch (e) { failed++; console.error(`\n  ✗ ${p.slug}: ${e.message}`); }
      if (++since >= 20) { save(); since = 0; }
      process.stdout.write(`\r  ${done} ок, ${failed} ош, осталось ${todo.length - done - failed}   `);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  save();
  console.log(`\nГотово. Успешно ${done}, ошибок ${failed}. В файле: ${Object.keys(store).length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
