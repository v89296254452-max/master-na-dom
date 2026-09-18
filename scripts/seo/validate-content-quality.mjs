#!/usr/bin/env node
/**
 * Детерминированный quality-валидатор для сгенерированного контента —
 * НЕ через LLM, только измеримые проверки. Можно гонять и ДО импорта
 * (на файле результатов генерации), и ПОСЛЕ (на текущем ai-content.db).
 *
 *   node scripts/seo/validate-content-quality.mjs --file=generated.json
 *   node scripts/seo/validate-content-quality.mjs --from-db
 *
 * Пишет reports/noindex-content-quality.csv.
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const BLACKLIST = ["климат", "умеренно-континентальн", "циклон", "население города", "географическое положение", "история города"];
const MIN_PARA_LEN = 80;
const MAX_PARA_LEN = 900;

function argVal(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; } else field += c; }
    else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const experimentCsv = parseCsv(fs.readFileSync(path.join(ROOT, "reports/noindex-experiment.csv"), "utf-8"));
const meta = new Map(
  experimentCsv.map((r) => [r.URL.replace(/^https:\/\/master-na-dom\.online\//, "").replace(/\/$/, ""), r])
);

let entries = {};
if (process.argv.includes("--from-db")) {
  const db = new Database(path.join(ROOT, "data/ai-content.db"), { readonly: true });
  const rows = db.prepare("SELECT slug, data FROM content WHERE slug IN (" + [...meta.keys()].map(() => "?").join(",") + ")").all(...meta.keys());
  for (const r of rows) entries[r.slug] = JSON.parse(r.data);
  db.close();
} else {
  const file = argVal("file");
  if (!file) { console.error("Need --file=<path.json> or --from-db"); process.exit(1); }
  entries = JSON.parse(fs.readFileSync(file, "utf-8"));
}

// normalize a paragraph for cross-page similarity comparison: strip the
// specific city/service names so a "same template, city swapped" pattern
// becomes visible as an exact match after normalization.
function normalizeForSimilarity(text, city, service) {
  let t = text.toLowerCase();
  if (city) t = t.split(city.toLowerCase()).join("{city}");
  if (service) t = t.split(service.toLowerCase()).join("{service}");
  return t.replace(/\s+/g, " ").trim();
}

const normalizedParagraphs = []; // {slug, idx, norm}
const rows = [];
for (const [slug, entry] of Object.entries(entries)) {
  const m = meta.get(slug);
  const city = m?.city || "";
  const service = m?.service || "";
  const paras = Array.isArray(entry?.paragraphs) ? entry.paragraphs : [];
  const flags = [];

  if (paras.length < 4) flags.push(`PARA_COUNT_${paras.length}`);
  let totalLen = 0;
  paras.forEach((p, i) => {
    if (typeof p !== "string" || !p.trim()) { flags.push(`EMPTY_PARA_${i}`); return; }
    totalLen += p.length;
    if (p.length < MIN_PARA_LEN) flags.push(`SHORT_PARA_${i}`);
    if (p.length > MAX_PARA_LEN) flags.push(`LONG_PARA_${i}`);
    const low = p.toLowerCase();
    for (const term of BLACKLIST) if (low.includes(term)) flags.push(`BLACKLIST_TERM:${term}`);
    if (city && !low.includes(city.toLowerCase())) { /* not every paragraph needs the city - only flag if NONE do, checked below */ }
    normalizedParagraphs.push({ slug, idx: i, norm: normalizeForSimilarity(p, city, service) });
  });

  const anyCityMention = paras.some((p) => city && p.toLowerCase().includes(city.toLowerCase()));
  const anyServiceMention = paras.some((p) => service && p.toLowerCase().includes(service.toLowerCase()));
  if (!anyCityMention) flags.push("CITY_NOT_MENTIONED");
  if (!anyServiceMention) flags.push("SERVICE_NOT_MENTIONED");

  // exact-repeat check within the same entry
  const seenNorm = new Set();
  paras.forEach((p) => {
    const n = (p || "").trim().toLowerCase();
    if (n && seenNorm.has(n)) flags.push("DUPLICATE_PARAGRAPH_WITHIN_PAGE");
    seenNorm.add(n);
  });

  // crude keyword-stuffing heuristic: service name repeated more than once
  // per ~40 words in a single paragraph
  paras.forEach((p, i) => {
    if (!service) return;
    const words = p.split(/\s+/).length;
    const count = (p.toLowerCase().match(new RegExp(service.toLowerCase(), "g")) || []).length;
    if (words > 0 && count / words > 1 / 40) flags.push(`POSSIBLE_KEYWORD_STUFFING_PARA_${i}`);
  });

  rows.push({
    slug, city, service,
    paraCount: paras.length,
    totalChars: totalLen,
    flags: flags.join(";"),
    status: flags.filter((f) => f.startsWith("PARA_COUNT") || f.startsWith("EMPTY_") || f === "CITY_NOT_MENTIONED" || f === "SERVICE_NOT_MENTIONED").length ? "FAIL" : (flags.length ? "REVIEW" : "OK"),
  });
}

// cross-page near-duplicate detection: same normalized paragraph text (city/
// service stripped) appearing on >1 page = template reused verbatim, only
// the city/service name differs — exactly the pattern the ТЗ warns against.
const byNorm = new Map();
for (const np of normalizedParagraphs) {
  if (!byNorm.has(np.norm)) byNorm.set(np.norm, []);
  byNorm.get(np.norm).push(np.slug);
}
const crossPageDup = new Map(); // slug -> count of paragraphs that are template-identical to another page
for (const [, slugs] of byNorm) {
  const uniqueSlugs = [...new Set(slugs)];
  if (uniqueSlugs.length > 1) {
    for (const s of uniqueSlugs) crossPageDup.set(s, (crossPageDup.get(s) || 0) + 1);
  }
}
for (const r of rows) {
  const c = crossPageDup.get(r.slug) || 0;
  if (c > 0) {
    r.flags = (r.flags ? r.flags + ";" : "") + `CROSS_PAGE_TEMPLATE_REUSE_x${c}`;
    if (c >= 2 && r.status === "OK") r.status = "REVIEW"; // 1 shared paragraph can be OK (e.g. process description), 2+ is suspicious
  }
}

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
const header = ["slug", "city", "service", "paraCount", "totalChars", "status", "flags"];
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n");
fs.writeFileSync(path.join(ROOT, "reports/noindex-content-quality.csv"), csv, "utf-8");

const byStatus = {};
for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
console.log(`Checked ${rows.length} entries: ${JSON.stringify(byStatus)}`);
console.log(`Written: reports/noindex-content-quality.csv`);
