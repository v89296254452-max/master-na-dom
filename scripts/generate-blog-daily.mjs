#!/usr/bin/env node
/**
 * Ежедневная ИИ-генерация уникальных статей блога (DeepSeek).
 *
 * DeepSeek сам предлагает свежие НЕ пересекающиеся темы (самоподдерживающийся
 * поток — не иссякает), затем пишет полную статью: заголовки, разделы,
 * практика, «Частые вопросы» (→ FAQPage-schema), [[CTA]]. Результат
 * дописывается в data/blog-posts.csv + content/blog/{slug}.mdx.
 *
 * Запуск: node scripts/generate-blog-daily.mjs [--count 3]
 * После генерации нужен pm2 reload (blog-posts.ts кэширует) — делает крон.
 *
 * Ключ/модель — из .env.generation (DeepSeek).
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CSV = path.join(ROOT, "data", "blog-posts.csv");
const MDX_DIR = path.join(ROOT, "content", "blog");

function argVal(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const COUNT = parseInt(argVal("--count", "3"), 10) || 3;

// ---- env ----
function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, ".env.generation"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}
const ENV = loadEnv();
const API_KEY = ENV.OPENROUTER_API_KEY;
const BASE_URL = ENV.OPENROUTER_BASE_URL || "https://api.deepseek.com";
const MODEL = ENV.OPENROUTER_MODEL || "deepseek-chat";
if (!API_KEY) { console.error("Нет OPENROUTER_API_KEY в .env.generation"); process.exit(1); }

const CATEGORIES = ["sovety", "remont", "vybor", "ceny", "instrukcia"];
const SERVICES = [
  "Сантехник", "Электрик", "Ремонт стиральных машин", "Ремонт холодильников",
  "Ремонт посудомоечных машин", "Ремонт водонагревателей", "Ремонт кондиционеров",
  "Ремонт телевизоров", "Ремонт кофемашин", "Компьютерная помощь", "Мастер на час",
];

async function deepseek(messages, maxTokens = 3500) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const resp = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.85, max_tokens: maxTokens }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error("нет JSON в ответе");
  return JSON.parse(m[0]);
}

function translit(s) {
  const map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return s.toLowerCase().split("").map((c) => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

function csvEscape(v) {
  v = String(v ?? "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function main() {
  fs.mkdirSync(MDX_DIR, { recursive: true });
  const csvRaw = fs.readFileSync(CSV, "utf8");
  const lines = csvRaw.split("\n");
  const header = lines[0];
  // существующие slug + последние заголовки (для антидубля тем)
  const existingSlugs = new Set();
  const titles = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols[0]) existingSlugs.add(cols[0].replace(/^"|"$/g, ""));
    const t = (cols[1] || "").replace(/^"|"$/g, "");
    if (t) titles.push(t);
  }
  const recentTitles = titles.slice(-250);

  // 1) DeepSeek предлагает свежие темы
  const topicsRaw = await deepseek([
    { role: "system", content: "Ты редактор блога сервиса «ПроМастер» (вызов мастера на дом: сантехника, электрика, ремонт бытовой техники). Предлагай конкретные, полезные, НЕ пересекающиеся темы статей." },
    { role: "user", content:
      `Предложи ${COUNT + 2} НОВЫХ тем статей для блога. Категории: ${CATEGORIES.join(", ")}. Услуги: ${SERVICES.join(", ")}.\n` +
      `Темы должны быть конкретными и полезными (реальные вопросы людей), НЕ повторять уже существующие:\n${recentTitles.slice(-120).map((t) => "- " + t).join("\n")}\n\n` +
      `Верни строго JSON-массив: [{"topic":"...","service":"<одна из услуг>","category":"<sovety|remont|vybor|ceny|instrukcia>"}]` },
  ], 900);
  let topics = parseJson(topicsRaw).filter((t) => t.topic && SERVICES.includes(t.service) && CATEGORIES.includes(t.category)).slice(0, COUNT);
  if (!topics.length) { console.log("Темы не сгенерированы"); return; }

  let done = 0;
  for (const t of topics) {
    // 2) полная статья
    let art;
    try {
      const raw = await deepseek([
        { role: "system", content: "Ты пишешь экспертные, полезные и уникальные статьи для блога сервиса ремонта на дому. Пиши по-русски, конкретно, без воды и кликбейта. Markdown." },
        { role: "user", content:
          `Напиши статью на тему: «${t.topic}» (услуга: ${t.service}, категория: ${t.category}).\n\n` +
          `Требования к body (markdown):\n` +
          `- 4–6 разделов «## Заголовок» с содержательным текстом (абзацы, где уместно — списки «- »).\n` +
          `- Первый раздел — краткое вступление; сразу после него отдельной строкой поставь [[CTA]].\n` +
          `- Обязательно предпоследний раздел «## Частые вопросы» с 4 вопросами в формате «### Вопрос?» и ответом следующей строкой.\n` +
          `- Практическая польза: причины, что можно проверить самому, когда звать мастера, ориентиры по цене.\n` +
          `- Естественно упомяни сервис ПроМастер 1–2 раза, без навязчивости. Объём 500–800 слов.\n\n` +
          `Верни строго JSON: {"title":"<meta title до 65 симв, заканчивается ' | ПроМастер'>","h1":"<заголовок без бренда>","description":"<meta 120–160 симв>","keywords":"<5-7 ключевых через запятую>","body":"<markdown статьи>"}` },
      ], 4000);
      art = parseJson(raw);
    } catch (e) { console.error(`  ✗ «${t.topic}»: ${e.message}`); continue; }
    if (!art.h1 || !art.body || art.body.length < 400) { console.error(`  ✗ «${t.topic}»: неполная статья`); continue; }

    let slug = translit(art.h1);
    if (!slug || existingSlugs.has(slug)) slug = `${slug || "post"}-${Date.now().toString(36).slice(-4)}`;
    if (existingSlugs.has(slug)) continue;

    const date = new Date().toISOString().slice(0, 10);
    const title = art.title.includes("ПроМастер") ? art.title : `${art.h1} | ПроМастер`;
    // mdx
    const frontmatter = `---\ntitle: ${JSON.stringify(title)}\nh1: ${JSON.stringify(art.h1)}\ndescription: ${JSON.stringify(art.description)}\ncategory: ${JSON.stringify(t.category)}\nservice: ${JSON.stringify(t.service)}\ndatePublished: ${JSON.stringify(date)}\n---\n\n`;
    fs.writeFileSync(path.join(MDX_DIR, `${slug}.mdx`), frontmatter + art.body.trim() + "\n", "utf8");
    // csv
    const row = [slug, title, art.h1, art.description, t.category, t.service, art.keywords || "", date].map(csvEscape).join(",");
    fs.appendFileSync(CSV, (csvRaw.endsWith("\n") ? "" : "\n") + row + "\n", "utf8");
    existingSlugs.add(slug);
    done++;
    console.log(`  ✓ ${slug} — «${art.h1}»`);
  }
  console.log(`\nГотово: опубликовано ${done} статей.`);
}

main().catch((e) => { console.error("Ошибка:", e.message); process.exit(1); });
