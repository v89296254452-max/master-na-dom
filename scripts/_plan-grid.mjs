import fs from "fs";

const sheets = JSON.parse(fs.readFileSync("xlsx-sheets.json", "utf8"));

// "Арамиль (Екатеринбург)" -> "Арамиль"; "Энгельс (Саратов" -> "Энгельс"
const normalize = (raw) => {
  let s = String(raw).trim().replace(/\s+/g, " ");
  s = s.replace(/\s*\(.*$/, "").trim();
  return s;
};

const isJunk = (s) => !s || !/\p{L}/u.test(s) || /^город$/i.test(s);

const perSheet = {};
const allCities = new Set();
let junk = [];

for (const code of Object.keys(sheets)) {
  const set = new Set();
  for (const raw of sheets[code].cities) {
    const c = normalize(raw);
    if (isJunk(c)) {
      junk.push(`${code}: ${JSON.stringify(raw)}`);
      continue;
    }
    set.add(c);
    allCities.add(c);
  }
  perSheet[code] = set;
}

console.log("JUNK ROWS FILTERED:", junk.length);
junk.forEach((j) => console.log("  ", j));

console.log("\nUNIQUE CITIES (normalized):", allCities.size);
console.log("\nPER-SHEET:");
let total = 0;
for (const code of Object.keys(perSheet)) {
  console.log(`  ${code}: ${perSheet[code].size}`);
  total += perSheet[code].size;
}
console.log("TOTAL service+city pairs (1 service per sheet):", total);
console.log("TOTAL if ВП counts twice (panels + ovens):", total + perSheet["ВП"].size);

const lines = fs.readFileSync("data/pages.csv", "utf8").trim().split(/\r?\n/).slice(1);
const siteCities = new Set(lines.map((l) => l.split(",")[1]));
const keep = [...siteCities].filter((c) => allCities.has(c));
const drop = [...siteCities].filter((c) => !allCities.has(c));
const add = [...allCities].filter((c) => !siteCities.has(c));

console.log("\nSITE cities:", siteCities.size);
console.log("KEEP (in Excel):", keep.length);
console.log("DROP (not in Excel):", drop.length);
console.log("ADD (new from Excel):", add.length);
console.log("\nADD LIST:", add.sort().join(", "));

fs.writeFileSync(
  "grid-plan.json",
  JSON.stringify(
    {
      cities: [...allCities].sort(),
      perSheet: Object.fromEntries(Object.entries(perSheet).map(([k, v]) => [k, [...v].sort()])),
    },
    null,
    2
  ),
  "utf8"
);
