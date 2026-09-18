import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const file = process.argv[2];
const wb = XLSX.readFile(file);
const out = {};

for (const name of wb.SheetNames) {
  if (name === "СТОП-ФАКТОРЫ") continue;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
  const title = String(rows[0]?.[0] ?? "").trim();
  const cities = [];
  const seen = new Set();
  for (const r of rows.slice(2)) {
    const raw = String(r?.[0] ?? "").trim().replace(/\s+/g, " ");
    if (!raw) continue;
    if (/^город$/i.test(raw)) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cities.push(raw);
  }
  out[name] = { title, count: cities.length, cities };
}

fs.writeFileSync("xlsx-sheets.json", JSON.stringify(out, null, 2), "utf8");

const allCities = new Set();
for (const k of Object.keys(out)) for (const c of out[k].cities) allCities.add(c);

console.log("sheets:", Object.keys(out).length);
for (const k of Object.keys(out)) console.log(`${k}: ${out[k].count} — ${out[k].title}`);
console.log("UNIQUE CITIES TOTAL:", allCities.size);
console.log("TOTAL PAIRS:", Object.values(out).reduce((s, v) => s + v.count, 0));
