import fs from "fs";

const src = fs.readFileSync("lib/leads-api.ts", "utf8");
const block = src.match(/const CITY_ID[^=]*=\s*\{([\s\S]*?)\n\};/)[1];
const ids = new Set([...block.matchAll(/"?([a-zа-яё]+)"?\s*:\s*\d+/gi)].map((m) => m[1]));

const lines = fs.readFileSync("data/pages.csv", "utf8").split(/\r?\n/).filter(Boolean);
const header = lines[0].split(",").map((h) => h.trim());
const cityIdx = header.indexOf("city");

const cities = new Set();
for (const line of lines.slice(1)) {
  const cell = line.split(",")[cityIdx];
  if (cell) cities.add(cell.replace(/^"|"$/g, "").trim());
}

const norm = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/[\s-]/g, "").trim();
const missing = [...cities].filter((c) => !ids.has(norm(c))).sort((a, b) => a.localeCompare(b, "ru"));
const unused = [...ids].filter((id) => ![...cities].some((c) => norm(c) === id)).sort();

console.log(`колонка city = ${cityIdx}`);
console.log(`городов в сетке: ${cities.size}`);
console.log(`city_id известен: ${cities.size - missing.length}`);
console.log(`city_id НЕТ: ${missing.length}`);
console.log(missing.join(", "));
console.log(`\nid в карте, которых нет в сетке: ${unused.length}`);
console.log(unused.join(", "));
