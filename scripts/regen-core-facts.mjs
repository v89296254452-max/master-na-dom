#!/usr/bin/env node
/**
 * Шаг 3: регенерация текста CORE-страниц (топ-города × услуги), привязанного к
 * РЕАЛЬНЫМ фактам города из data/city-facts.json (районы/климат/вода/застройка).
 * Пишет в data/ai-content.money.json (перекрывает базовые записи при сборке БД).
 *
 * Правила: топоним 2-4 раза, опора минимум на 3 факта города, без переспама,
 * между-город схожесть < 85%. Чекпойнт: готовые slug пропускаются (по маркеру).
 *
 * Запуск: node scripts/regen-core-facts.mjs [--limit N] [--concurrency 6]
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const PAGES = path.join(ROOT, "data", "pages.csv");
const FACTS = path.join(ROOT, "data", "city-facts.json");
const OUT = path.join(ROOT, "data", "ai-content.money.json");

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LIMIT = parseInt(argVal("--limit", "0"), 10) || 0;
const CONC = parseInt(argVal("--concurrency", "6"), 10) || 6;

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
function corePages() {
  const rec = parseRecords(fs.readFileSync(PAGES, "utf8"));
  const h = rec[0].map(x => x.trim()); const idx = n => h.indexOf(n);
  const iS = idx("slug"), iC = idx("city"), iP = idx("cityPrepositional"), iSv = idx("service");
  return rec.slice(1).filter(r => r[iS] && TOP.has((r[iC] || "").trim())).map(r => ({
    slug: r[iS].trim(), city: (r[iC] || "").trim(), cityPrep: (r[iP] || r[iC] || "").trim(), service: (r[iSv] || "").trim(),
  }));
}

const facts = (() => { try { const j = JSON.parse(fs.readFileSync(FACTS, "utf8")); const m = new Map(); for (const k in j) if (j[k]?.city) m.set(j[k].city.trim().toLowerCase(), j[k]); return m; } catch { return new Map(); } })();

function prompt(p) {
  const f = facts.get(p.city.toLowerCase()) || {};
  const known = [];
  if (f.districts?.length) known.push(`Реальные районы: ${f.districts.join(", ")}.`);
  if (f.housing) known.push(`Застройка: ${f.housing}.`);
  if (f.water_hardness) known.push(`Вода: ${f.water_hardness}.`);
  if (f.climate_note) known.push(`Климат: ${f.climate_note}.`);
  if (f.notable) known.push(`Особенность: ${f.notable}.`);
  const factsBlock = known.length ? known.join("\n") : "(проверенных локальных фактов нет — не выдумывай их, пиши общо, но естественно)";
  return `Ты — практикующий мастер сервиса «ПроМастер». Напиши УНИКАЛЬНЫЙ экспертный текст для страницы «${p.service}» в городе ${p.city} (предложный: «в ${p.cityPrep}»).

РЕАЛЬНЫЕ ФАКТЫ О ГОРОДЕ (опирайся минимум на 3, органично; НЕ выдумывай сверх этого):
${factsBlock}

Требования:
- about: 6-8 абзацев, 1500-2500 знаков. Живо, для клиента. Вплети минимум 3 реальных факта города (районы/застройка/вода/климат) — так, чтобы текст НЕ подходил другому городу.
- Название города упомяни 2-4 раза на весь текст (НЕ в каждом абзаце, без переспама).
- Раскрой: типичные поломки/ситуации по услуге, как работает мастер, что влияет на цену, что проверить самому, гарантии.
- Без клише «качественно и недорого», без списков ключевых слов, без выдуманных цен/адресов/телефонов/отзывов.

Верни строго JSON без markdown:
{"description":"мета 150-165 символов с городом, услугой, призывом","paragraphs":["...6-8 абзацев..."]}`;
}

async function one(p, attempt = 1) {
  let res;
  try { res = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt(p) }], temperature: 0.85, max_tokens: 2600, response_format: { type: "json_object" } }) }); }
  catch (e) { if (attempt < 5) { await new Promise(r => setTimeout(r, 2500 * attempt)); return one(p, attempt + 1); } throw e; }
  if (!res.ok) { if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < 5) { await new Promise(r => setTimeout(r, (res.status === 403 ? 12000 : 2000) * attempt)); return one(p, attempt + 1); } throw new Error("HTTP " + res.status); }
  const d = await res.json(); const c = d.choices?.[0]?.message?.content || "";
  const strip = s => { let o = ""; for (let i = 0; i < s.length; i++) o += s.charCodeAt(i) < 32 ? " " : s[i]; return o; };
  let pr = null; try { pr = JSON.parse(strip(c)); } catch { const m = strip(c).match(/\{[\s\S]*\}/); if (m) try { pr = JSON.parse(m[0]); } catch {} }
  if (!pr || !Array.isArray(pr.paragraphs) || pr.paragraphs.length < 6) { if (attempt < 4) return one(p, attempt + 1); throw new Error("bad json"); }
  const clean = s => String(s).replace(/[`*#_]+/g, "").replace(/\s{2,}/g, " ").trim();
  return { description: typeof pr.description === "string" ? clean(pr.description) : undefined, paragraphs: pr.paragraphs.map(clean).filter(Boolean), _facts: true };
}

async function main() {
  const pages = corePages();
  let store = {}; try { store = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
  // регенерируем только те, что ещё не помечены _facts (чекпойнт)
  let todo = pages.filter(p => !store[p.slug]?._facts);
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);
  console.log(`CORE: ${pages.length}, к регенерации на фактах: ${todo.length}`);
  if (!todo.length) return;
  let done = 0, failed = 0, next = 0, sinceSave = 0;
  const save = () => fs.writeFileSync(OUT, JSON.stringify(store, null, 0));
  async function worker() {
    while (next < todo.length) {
      const p = todo[next++];
      try { store[p.slug] = await one(p); done++; }
      catch (e) { failed++; console.error(`\n  ✗ ${p.slug}: ${e.message}`); }
      if (++sinceSave >= 20) { save(); sinceSave = 0; }
      process.stdout.write(`\r  ${done} ок, ${failed} ош, осталось ${todo.length - done - failed}   `);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  save();
  console.log(`\nГотово. Успешно ${done}, ошибок ${failed}.`);
}
main().catch(e => { console.error(e); process.exit(1); });
