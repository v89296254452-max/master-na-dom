#!/usr/bin/env node
/**
 * Deterministic SEO opportunity score — keyword+URL pairs from
 * data/seo/rankings.csv joined against reports/seo-pages.csv.
 *
 * NO LLM. Formula documented here, not hidden:
 *
 *   score = positionWeight(position) * log2(frequency + 2) * intentMultiplier
 *
 * positionWeight (главный вес — по вашему ТЗ):
 *   11-20   -> 10   (максимальный: ближе всего к TOP10, наибольший потенциал)
 *   21-30   -> 8    (высокий)
 *   4-10    -> 5    (средний — уже в TOP10, есть куда расти до TOP3, но
 *                    возможностей меньше, чем у 11-30)
 *   31-50   -> 4    (средний)
 *   51-100  -> 2    (ниже)
 *   1-3     -> 1    (уже почти максимум, низкий приоритет доработки)
 *   нет данных (за пределами топ-100 отслеживания) -> 0.5
 *
 * frequency: реальная частотность (Wordstat-фактор) из выгрузки, через
 * log2(freq+2) — чтобы один сверхвысокочастотный запрос не забивал всю
 * таблицу (частоты в выгрузке от 0 до тысяч).
 *
 * intentMultiplier: 1.2 если запрос выглядит коммерческим (нет маркеров
 * информационного интента), 0.8 если похож на информационный
 * ("почему", "как", "что делать", "зачем", "что если" — Этап 9 ТЗ).
 * Эвристика по ключевым словам в самом запросе, не по LLM.
 *
 * impressions/CTR/lead availability/revenue: данных нет в репозитории —
 * НЕ учитываются (не выдумываем), не участвуют в формуле. Если появятся
 * реальные данные (Yandex Webmaster/Metrika выгрузка) — добавить как
 * дополнительный множитель, не меняя базовую формулу.
 *
 * Usage: node scripts/seo/opportunity-score.mjs
 * Writes reports/seo-opportunities.csv, prints TOP 50 to stdout.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function parseCsv(text) {
  // Minimal RFC4180-ish parser (handles quoted fields with commas/newlines) -
  // sufficient here, no external dep needed for this offline script.
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
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

const rankings = parseCsv(fs.readFileSync(path.join(ROOT, "data/seo/rankings.csv"), "utf-8"));
const pages = parseCsv(fs.readFileSync(path.join(ROOT, "reports/seo-pages.csv"), "utf-8"));
const pageByUrl = new Map(pages.map((p) => [p.url.replace(/\/$/, ""), p]));

const INFO_MARKERS = ["почему", "как ", "что делать", "зачем", "что если", "можно ли самому", "своими руками"];

function positionWeight(pos) {
  if (pos == null || pos === "") return 0.5;
  const p = Number(pos);
  if (p <= 3) return 1;
  if (p <= 10) return 5;
  if (p <= 20) return 10;
  if (p <= 30) return 8;
  if (p <= 50) return 4;
  if (p <= 100) return 2;
  return 0.5;
}

function intentMultiplier(keyword) {
  const low = keyword.toLowerCase();
  return INFO_MARKERS.some((m) => low.includes(m)) ? 0.8 : 1.2;
}

const rows = [];
for (const r of rankings) {
  const url = (r.url || "").replace(/\/$/, "");
  const page = pageByUrl.get(url);
  const pos = r.position ? Number(r.position) : null;
  const freq = r.frequency ? Number(r.frequency) : 0;
  const pw = positionWeight(pos);
  const im = intentMultiplier(r.keyword);
  const score = Math.round(pw * Math.log2(freq + 2) * im * 100) / 100;
  rows.push({
    keyword: r.keyword,
    url: r.url,
    position: pos ?? "",
    previousPosition: r.previousPosition || "",
    frequency: freq,
    region: r.region || "",
    pageType: page ? page.pageType : "UNKNOWN",
    positionWeight: pw,
    intentMultiplier: im,
    score,
    bucket: pos == null ? "101+" : pos <= 3 ? "TOP3" : pos <= 10 ? "TOP10" : pos <= 20 ? "11-20" : pos <= 30 ? "21-30" : pos <= 50 ? "31-50" : pos <= 100 ? "51-100" : "101+",
  });
}

rows.sort((a, b) => b.score - a.score);

const header = ["keyword", "url", "position", "previousPosition", "frequency", "region", "pageType", "bucket", "positionWeight", "intentMultiplier", "score"];
const csvEscape = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csvLines = [header.join(",")];
for (const r of rows) csvLines.push(header.map((h) => csvEscape(r[h])).join(","));
fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "reports/seo-opportunities.csv"), csvLines.join("\n"), "utf-8");

console.log(`Всего пар keyword+URL: ${rows.length}`);
console.log(`\nTOP 50 opportunities:\n`);
console.log(header.join("\t"));
for (const r of rows.slice(0, 50)) {
  console.log(header.map((h) => r[h]).join("\t"));
}
