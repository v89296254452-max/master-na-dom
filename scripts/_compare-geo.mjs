import fs from "fs";

const sheets = JSON.parse(fs.readFileSync("xlsx-sheets.json", "utf8"));

const stripParent = (s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();

const excelCities = new Map();
for (const code of Object.keys(sheets)) {
  for (const raw of sheets[code].cities) {
    const base = stripParent(raw);
    if (!excelCities.has(base)) excelCities.set(base, new Set());
    excelCities.get(base).add(raw);
  }
}

const lines = fs.readFileSync("data/pages.csv", "utf8").trim().split(/\r?\n/).slice(1);
const siteCities = new Set();
for (const l of lines) siteCities.add(l.split(",")[1]);

const excelSet = new Set(excelCities.keys());
const inBoth = [...excelSet].filter((c) => siteCities.has(c));
const onlyExcel = [...excelSet].filter((c) => !siteCities.has(c));
const onlySite = [...siteCities].filter((c) => !excelSet.has(c));

console.log("EXCEL unique base cities:", excelSet.size);
console.log("SITE cities:", siteCities.size);
console.log("IN BOTH:", inBoth.length);
console.log("\nONLY IN EXCEL (need to add):", onlyExcel.length);
onlyExcel.sort().forEach((c) => console.log("  +", c, JSON.stringify([...excelCities.get(c)])));
console.log("\nONLY ON SITE (candidates to remove):", onlySite.length);
onlySite.sort().forEach((c) => console.log("  -", c));

const dupes = [...excelCities.entries()].filter(([, v]) => v.size > 1);
console.log("\nBASE-NAME COLLISIONS in Excel:", dupes.length);
dupes.forEach(([k, v]) => console.log("  !", k, JSON.stringify([...v])));

console.log("\nPER-SHEET city counts (base):");
for (const code of Object.keys(sheets)) {
  console.log(`  ${code}: ${new Set(sheets[code].cities.map(stripParent)).size}`);
}
