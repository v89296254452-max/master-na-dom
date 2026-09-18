#!/usr/bin/env node
/**
 * Ежедневный авто-переобход в Яндекс.Вебмастере (ускоряет индексацию).
 * Шлёт приоритетные URL в /recrawl/queue в рамках дневной квоты (обычно 150).
 *
 * Приоритет: топ-города × коммерческие услуги (деньги) → затем ротация по всем
 * гео-страницам (курсор в data/recrawl-cursor.json) → всегда добавляем свежие
 * статьи блога. Цикл проходит весь пул за ~месяц, важные города чаще.
 *
 * Креды из .env.generation: YANDEX_WM_TOKEN, YANDEX_WM_USER, YANDEX_WM_HOST.
 * Запуск: node scripts/yandex-recrawl.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
function env() {
  const e = {};
  try {
    for (const l of fs.readFileSync(path.join(ROOT, ".env.generation"), "utf8").split("\n")) {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m) e[m[1]] = m[2].trim();
    }
  } catch {}
  return e;
}
const E = env();
const TOKEN = E.YANDEX_WM_TOKEN;
const USER = E.YANDEX_WM_USER;
const HOST = E.YANDEX_WM_HOST; // напр. https:master-na-dom.online:443
const SITE = "https://master-na-dom.online";
if (!TOKEN || !USER || !HOST) { console.error("Нет YANDEX_WM_* в .env.generation"); process.exit(1); }

const API = `https://api.webmaster.yandex.net/v4/user/${USER}/hosts/${HOST}`;
const CURSOR = path.join(ROOT, "data", "recrawl-cursor.json");

// Топ-города (славские: сначала переобходим денежные) — по slug города.
const TOP_CITIES = [
  "moskva","sankt-peterburg","novosibirsk","ekaterinburg","kazan","nizhniy-novgorod",
  "chelyabinsk","samara","omsk","rostov-na-donu","ufa","krasnoyarsk","voronezh","perm",
  "volgograd","krasnodar","saratov","tyumen","tolyatti","izhevsk","barnaul","ulyanovsk",
  "irkutsk","habarovsk","yaroslavl","vladivostok","mahachkala","tomsk","orenburg","kemerovo",
];
// Коммерческие услуги (высокий интент).
const CORE_SERVICES = [
  "santehnik","elektrik","remont-holodilnikov","remont-stiralnyh-mashin",
  "remont-kondicionerov","master-na-chas","kp","remont-televizorov",
];

function readCsvSlugs(file) {
  try {
    const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n").filter(Boolean);
    const idx = lines[0].split(",").indexOf("slug");
    return lines.slice(1).map((l) => l.split(",")[idx]).filter(Boolean);
  } catch { return []; }
}

async function recrawl(url) {
  try {
    const r = await fetch(`${API}/recrawl/queue`, {
      method: "POST",
      headers: { Authorization: `OAuth ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (r.status === 202 || r.ok) return "ok";
    const t = await r.text();
    if (/quota/i.test(t)) return "quota";
    return `err ${r.status}`;
  } catch (e) { return "fail"; }
}

async function main() {
  // квота
  let quota = 140;
  try {
    const q = await (await fetch(`${API}/recrawl/quota`, { headers: { Authorization: `OAuth ${TOKEN}` } })).json();
    quota = Math.max(0, Math.min(140, q.quota_remainder ?? 140));
  } catch {}
  if (quota <= 0) { console.log("Квота переобхода исчерпана на сегодня"); return; }

  // пул приоритета: топ-города×услуги (деньги) + все гео (ротация) — уникально, по порядку
  const geoAll = readCsvSlugs("data/pages.csv");
  const geoSet = new Set(geoAll);
  const priority = [];
  for (const c of TOP_CITIES) for (const s of CORE_SERVICES) {
    const slug = `${s}-${c}`;
    if (geoSet.has(slug)) priority.push(slug);
  }
  const prioritySet = new Set(priority);
  const rotation = geoAll.filter((s) => !prioritySet.has(s));

  // курсоры ротации
  let cursor = 0, boostCursor = 0;
  try { const c = JSON.parse(fs.readFileSync(CURSOR, "utf8")); cursor = c.cursor || 0; boostCursor = c.boostCursor || 0; } catch {}

  // BOOST-список: страницы, которые недавно вышли из noindex (получили ИИ-текст)
  // — их Яндекс раньше выкинул как тонкие, надо переобойти в приоритете, чтобы
  // переоценил. Файл data/recrawl-boost.txt (по одному slug на строку).
  let boost = [];
  try {
    boost = fs.readFileSync(path.join(ROOT, "data", "recrawl-boost.txt"), "utf8")
      .split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {}

  // свежие статьи блога (всегда, до 10)
  const blog = readCsvSlugs("data/blog-posts.csv").slice(-10).map((s) => `blog/${s}`);

  // формируем список на сегодня
  const today = [];
  for (const s of blog) { if (today.length < quota) today.push(`${SITE}/${s}`); }
  // BOOST — до 100 в день, курсором по всему списку (за ~9 дней пройдёт 900)
  let boostTaken = 0;
  const BOOST_PER_DAY = 100;
  while (today.length < quota && boostTaken < Math.min(BOOST_PER_DAY, boost.length)) {
    const s = boost[(boostCursor + boostTaken) % boost.length];
    today.push(`${SITE}/${s}`);
    boostTaken++;
  }
  const newBoostCursor = boost.length ? (boostCursor + boostTaken) % boost.length : 0;
  // приоритетные города — небольшую порцию каждый день (первые 20)
  for (const s of priority.slice(0, 20)) { if (today.length < quota) today.push(`${SITE}/${s}`); }
  // ротация по остальным гео
  let taken = 0;
  while (today.length < quota && taken < rotation.length) {
    const s = rotation[(cursor + taken) % rotation.length];
    today.push(`${SITE}/${s}`);
    taken++;
  }
  const newCursor = (cursor + taken) % (rotation.length || 1);

  // отправка
  let ok = 0, quotaHit = 0, fail = 0;
  for (const url of today) {
    const res = await recrawl(url);
    if (res === "ok") ok++;
    else if (res === "quota") { quotaHit++; break; }
    else fail++;
    await new Promise((r) => setTimeout(r, 400)); // не долбим API
  }
  fs.writeFileSync(CURSOR, JSON.stringify({ cursor: newCursor, boostCursor: newBoostCursor, updatedAt: new Date().toISOString() }));
  console.log(`Переобход: отправлено ${ok} (boost ${boostTaken}), квота-стоп ${quotaHit}, ошибок ${fail}. Курсоры: ротация→${newCursor}/${rotation.length}, boost→${newBoostCursor}/${boost.length}`);
}

main().catch((e) => { console.error("Ошибка:", e.message); process.exit(1); });
