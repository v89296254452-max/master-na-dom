#!/usr/bin/env node
/**
 * Шаг 1: датасет реальных фактов по городам (data/city-facts.json).
 * DeepSeek извлекает ТОЛЬКО известные факты; где не уверен — пустое поле.
 * Строго запрещено выдумывать районы/цифры. Чекпойнт: готовые города пропускаются.
 *
 * Запуск: node scripts/build-city-facts.mjs [--limit N] [--concurrency 5] [--only-top]
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "data", "city-facts.json");
const PAGES = path.join(ROOT, "data", "pages.csv");

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LIMIT = parseInt(argVal("--limit", "0"), 10) || 0;
const CONC = parseInt(argVal("--concurrency", "5"), 10) || 5;
const ONLY_TOP = args.includes("--only-top");

function env() { const e = {}; try { for (const l of fs.readFileSync(path.join(ROOT, ".env.generation"), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) e[m[1]] = m[2].trim(); } } catch {} return e; }
const E = env();
const KEY = E.OPENROUTER_API_KEY, BASE = E.OPENROUTER_BASE_URL || "https://api.deepseek.com", MODEL = E.OPENROUTER_MODEL || "deepseek-chat";
if (!KEY) { console.error("нет ключа"); process.exit(1); }

const TOP = new Set(["Москва","Санкт-Петербург","Новосибирск","Екатеринбург","Казань","Нижний Новгород","Челябинск","Самара","Уфа","Ростов-на-Дону","Краснодар","Омск","Воронеж","Пермь","Волгоград","Красноярск","Саратов","Тюмень","Тольятти","Ижевск","Барнаул","Ульяновск","Иркутск","Хабаровск","Ярославль","Владивосток","Махачкала","Томск","Оренбург","Кемерово","Новокузнецк","Рязань","Астрахань","Пенза","Липецк","Киров","Чебоксары","Тула","Калининград","Сочи"]);

function cities() {
  const raw = fs.readFileSync(PAGES, "utf8").split("\n").slice(1).filter(Boolean);
  const seen = new Map();
  for (const line of raw) {
    // slug первым полем; city вторым (без запятых внутри — простой split ок для 2 полей)
    const slug = line.split(",")[0];
    const city = line.split(",")[1];
    if (!city || seen.has(city)) continue;
    const citySlug = slug.slice(slug.indexOf("-") + 1); // после первого сервис-префикса не всегда; берём хвост
    seen.set(city, slug.split("-").slice(-1)[0]);
  }
  return [...seen.entries()].map(([city, s]) => ({ city, slug: s }));
}

function prompt(city) {
  return `Ты — справочник по городам России. Дай ТОЛЬКО РЕАЛЬНЫЕ, известные факты о городе ${city}. НИЧЕГО НЕ ВЫДУМЫВАЙ: если факт не знаешь точно — верни пустую строку/массив. Особенно НЕ придумывай названия районов.

Верни строго JSON:
{
 "districts": ["реальные районы/округа/крупные микрорайоны города ${city}, 4-8 шт; если не уверен — []"],
 "housing": "краткое описание типичной застройки ${city} (напр. 'сталинки в центре, хрущёвки и панель советской эпохи, новостройки на окраинах') или ''",
 "water_hardness": "жёсткость воды в ${city}, если это известный факт (напр. 'жёсткая, много накипи' / 'мягкая') иначе ''",
 "climate_note": "короткий реальный климат-факт, влияющий на быт/технику (напр. 'резко континентальный, морозы до -35' / 'влажный субтропический') или ''",
 "population_tier": "один из: 'миллионник' | 'крупный' | 'средний' | 'малый'",
 "price_coef": число 0.7-1.3 — уровень цен на бытовые услуги относительно среднего по РФ (Москва ~1.3, малые города ~0.8); если не уверен — 1.0,
 "notable": "1 короткий реальный локальный факт, полезный для контекста услуг на дому (промзоны, частный сектор, курортность и т.п.) или ''"
}`;
}

async function one(city, attempt = 1) {
  let res;
  try {
    res = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt(city) }], temperature: 0.3, max_tokens: 700, response_format: { type: "json_object" } }) });
  } catch (e) { if (attempt < 5) { await new Promise(r => setTimeout(r, 2500 * attempt)); return one(city, attempt + 1); } throw e; }
  if (!res.ok) { if ((res.status === 429 || res.status >= 500) && attempt < 5) { await new Promise(r => setTimeout(r, 2000 * attempt)); return one(city, attempt + 1); } throw new Error("HTTP " + res.status); }
  const d = await res.json();
  const c = d.choices?.[0]?.message?.content || "";
  let p = null; try { p = JSON.parse(c); } catch { const m = c.match(/\{[\s\S]*\}/); if (m) try { p = JSON.parse(m[0]); } catch {} }
  if (!p) { if (attempt < 3) return one(city, attempt + 1); throw new Error("bad json"); }
  return {
    districts: Array.isArray(p.districts) ? p.districts.filter(x => typeof x === "string" && x.trim()).slice(0, 8) : [],
    housing: typeof p.housing === "string" ? p.housing.trim() : "",
    water_hardness: typeof p.water_hardness === "string" ? p.water_hardness.trim() : "",
    climate_note: typeof p.climate_note === "string" ? p.climate_note.trim() : "",
    population_tier: ["миллионник","крупный","средний","малый"].includes(p.population_tier) ? p.population_tier : "",
    price_coef: typeof p.price_coef === "number" && p.price_coef >= 0.6 && p.price_coef <= 1.5 ? p.price_coef : 1.0,
    notable: typeof p.notable === "string" ? p.notable.trim() : "",
  };
}

async function main() {
  let store = {}; try { store = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
  let list = cities();
  if (ONLY_TOP) list = list.filter(c => TOP.has(c.city));
  // топ-города первыми
  list.sort((a, b) => (TOP.has(b.city) ? 1 : 0) - (TOP.has(a.city) ? 1 : 0));
  let todo = list.filter(c => !store[c.slug]);
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);
  console.log(`Городов: ${list.length}, к сбору: ${todo.length}`);
  if (!todo.length) return;
  let done = 0, failed = 0, next = 0, sinceSave = 0;
  const save = () => fs.writeFileSync(OUT, JSON.stringify(store, null, 1));
  async function worker() {
    while (next < todo.length) {
      const c = todo[next++];
      try { store[c.slug] = { city: c.city, ...(await one(c.city)) }; done++; }
      catch (e) { failed++; console.error(`\n  ✗ ${c.city}: ${e.message}`); }
      if (++sinceSave >= 15) { save(); sinceSave = 0; }
      process.stdout.write(`\r  ${done} ок, ${failed} ош, осталось ${todo.length - done - failed}   `);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  save();
  // отчёт по пустым полям
  const empties = { districts: 0, water_hardness: 0, climate_note: 0, housing: 0 };
  for (const k in store) { const r = store[k]; if (!r.districts?.length) empties.districts++; if (!r.water_hardness) empties.water_hardness++; if (!r.climate_note) empties.climate_note++; if (!r.housing) empties.housing++; }
  console.log(`\nГотово. Успешно ${done}, ошибок ${failed}. Всего в датасете: ${Object.keys(store).length}`);
  console.log(`Пустые поля: districts=${empties.districts}, water_hardness=${empties.water_hardness}, climate=${empties.climate_note}, housing=${empties.housing}`);
}
main().catch(e => { console.error(e); process.exit(1); });
