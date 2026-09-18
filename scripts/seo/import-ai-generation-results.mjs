#!/usr/bin/env node
/**
 * Безопасный импорт результатов ЛОКАЛЬНОЙ генерации контента для 30
 * experimental noindex-страниц обратно в ai-content.db.
 *
 * Пишет ТОЛЬКО в SQLite (data/ai-content.db) точечными INSERT OR REPLACE по
 * конкретным slug — НЕ трогает гигантские data/ai-content*.json (233MB+,
 * см. docs/PRODUCTION-MEMORY-AUDIT.md о том, почему их вообще не грузим в
 * память целиком).
 *
 * Жёсткий whitelist: принимает ТОЛЬКО slug из group=EXPERIMENTAL в
 * reports/noindex-experiment.csv. Любой другой slug в файле результатов —
 * отклоняется (control group и все остальные 826 noindex-страниц не могут
 * быть случайно затронуты этим скриптом).
 *
 * Usage:
 *   node scripts/seo/import-ai-generation-results.mjs --file=generated.json --dry-run
 *   node scripts/seo/import-ai-generation-results.mjs --file=generated.json
 *
 * Ожидаемый формат --file (объект по slug, как отдаёт export-скрипт + ваша генерация):
 *   { "dezinfekciya-moskva": { "paragraphs": ["...","...","...","..."], "description"?: "..." }, ... }
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data/ai-content.db");

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

function argVal(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
}
const DRY_RUN = process.argv.includes("--dry-run");
const FILE = argVal("file");
if (!FILE) {
  console.error("Usage: node scripts/seo/import-ai-generation-results.mjs --file=<path.json> [--dry-run]");
  process.exit(1);
}

// ---- 1. whitelist: only EXPERIMENTAL slugs may ever be written by this script ----
const experimentCsv = parseCsv(fs.readFileSync(path.join(ROOT, "reports/noindex-experiment.csv"), "utf-8"));
const whitelist = new Set(
  experimentCsv
    .filter((r) => r.group === "EXPERIMENTAL")
    .map((r) => r.URL.replace(/^https:\/\/master-na-dom\.online\//, "").replace(/\/$/, ""))
);
console.log(`Whitelist: ${whitelist.size} EXPERIMENTAL slugs (control + other 826 noindex pages are NOT eligible)`);

// ---- 2. load results ----
let results;
try {
  results = JSON.parse(fs.readFileSync(FILE, "utf-8"));
} catch (e) {
  console.error(`Cannot read/parse ${FILE}: ${e.message}`);
  process.exit(1);
}

// ---- 3. validation (deterministic, matches the site's own gate + extra sanity) ----
const MIN_PARA_LEN = 80; // символов - отсекает пустышки/заглушки
const MAX_PARA_LEN = 900; // разумный потолок на абзац
const BLACKLIST = ["климат", "умеренно-континентальн", "циклон", "население города", "географическое положение", "история города"];

function validateEntry(slug, entry) {
  const errors = [];
  const warnings = [];
  if (!whitelist.has(slug)) {
    errors.push("NOT_IN_EXPERIMENTAL_WHITELIST - refusing to touch (control group or other noindex page)");
    return { errors, warnings }; // stop here, don't bother with content checks
  }
  if (!entry || typeof entry !== "object") { errors.push("entry is not an object"); return { errors, warnings }; }
  const paras = entry.paragraphs;
  if (!Array.isArray(paras)) { errors.push("paragraphs is not an array"); return { errors, warnings }; }
  if (paras.length < 4) errors.push(`only ${paras.length} paragraphs, need >=4 (site's own gate: ai.paragraphs.length >= 4)`);
  paras.forEach((p, i) => {
    if (typeof p !== "string" || !p.trim()) { errors.push(`paragraph ${i} is empty`); return; }
    if (p.length < MIN_PARA_LEN) warnings.push(`paragraph ${i} is short (${p.length} chars, expected >=${MIN_PARA_LEN})`);
    if (p.length > MAX_PARA_LEN) warnings.push(`paragraph ${i} is long (${p.length} chars, expected <=${MAX_PARA_LEN})`);
    const low = p.toLowerCase();
    for (const term of BLACKLIST) {
      if (low.includes(term)) warnings.push(`paragraph ${i} contains blacklisted low-value term: "${term}"`);
    }
  });
  // duplicate-paragraph check (across this entry's own paragraphs)
  const seen = new Set();
  paras.forEach((p, i) => {
    const norm = (p || "").trim().toLowerCase();
    if (norm && seen.has(norm)) warnings.push(`paragraph ${i} is a duplicate of another paragraph in the same entry`);
    seen.add(norm);
  });
  return { errors, warnings };
}

const report = [];
const toWrite = [];
for (const [slug, entry] of Object.entries(results)) {
  const { errors, warnings } = validateEntry(slug, entry);
  report.push({ slug, ok: errors.length === 0, errors, warnings });
  if (errors.length === 0) toWrite.push([slug, entry]);
}

console.log(`\n=== Validation ===`);
for (const r of report) {
  const status = r.ok ? "OK  " : "SKIP";
  console.log(`${status} ${r.slug}`);
  for (const e of r.errors) console.log(`     ERROR: ${e}`);
  for (const w of r.warnings) console.log(`     warn:  ${w}`);
}
console.log(`\n${toWrite.length}/${Object.keys(results).length} entries pass validation.`);

// also report which whitelisted slugs are MISSING from the results file
const providedSlugs = new Set(Object.keys(results));
const missing = [...whitelist].filter((s) => !providedSlugs.has(s));
if (missing.length) {
  console.log(`\n${missing.length} EXPERIMENTAL slugs have NO entry in ${FILE} yet (not generated):`);
  for (const s of missing) console.log(`  - ${s}`);
}

if (DRY_RUN) {
  console.log(`\n--dry-run: no database changes made.`);
  process.exit(toWrite.length > 0 ? 0 : 1);
}

if (toWrite.length === 0) {
  console.log("\nNothing valid to write. Exiting.");
  process.exit(1);
}

// ---- 4. backup ai-content.db before writing ----
if (!fs.existsSync(DB_PATH)) {
  console.error(`${DB_PATH} does not exist - refusing to write (this script only updates an existing DB).`);
  process.exit(1);
}
const backupPath = `${DB_PATH}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
fs.copyFileSync(DB_PATH, backupPath);
console.log(`\nBackup created: ${backupPath}`);

// ---- 5. write (INSERT OR REPLACE, only the whitelisted+valid slugs) ----
const db = new Database(DB_PATH);
const insert = db.prepare("INSERT OR REPLACE INTO content (slug, data) VALUES (?, ?)");
const tx = db.transaction((entries) => {
  for (const [slug, entry] of entries) {
    insert.run(slug, JSON.stringify({ description: entry.description, paragraphs: entry.paragraphs, faqs: entry.faqs }));
  }
});
tx(toWrite);
db.close();

console.log(`\nWrote ${toWrite.length} entries to ${DB_PATH}.`);
console.log(`Rollback if needed: cp ${backupPath} ${DB_PATH}`);
