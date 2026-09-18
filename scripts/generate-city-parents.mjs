/**
 * Генерирует lib/geo-agglomeration.ts — карту «город-спутник → головной город».
 *
 * В листах партнёрки город указан вместе с агломерацией: «Арамиль (Екатеринбург)»,
 * «Колпино (Санкт-Петербург)». Для страниц скобка отрезается, но для передачи
 * заявки в CRM она важна: у спутника нет своего city_id, заявка должна уходить
 * с id головного города.
 *
 * Запуск: node scripts/generate-city-parents.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL = path.join(process.cwd(), "data", "pulse.xlsx");
const OUT = path.join(process.cwd(), "lib", "geo-agglomeration.ts");

const norm = (s) => String(s).toLowerCase().replace(/ё/g, "е").replace(/[\s-]/g, "").trim();

const wb = XLSX.readFile(EXCEL);
const pairs = new Map();

for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
  for (const row of rows) {
    const raw = String(row?.[0] ?? "").trim();
    // «Город (Головной» — закрывающая скобка в файле местами отсутствует
    const m = raw.match(/^([^()]+?)\s*\(\s*([^()]+?)\s*\)?$/);
    if (!m) continue;
    const [, child, parent] = m;
    if (!/\p{L}/u.test(child) || !/\p{L}/u.test(parent)) continue;
    const key = norm(child);
    const value = norm(parent);
    if (!key || !value || key === value) continue;
    pairs.set(key, value);
  }
}

const entries = [...pairs.entries()].sort(([a], [b]) => a.localeCompare(b, "ru"));

const body = entries.map(([k, v]) => `  ${k}: "${v}",`).join("\n");
const file = `/**
 * Город-спутник → головной город агломерации (нормализованные ключи).
 * Сгенерировано из data/pulse.xlsx: node scripts/generate-city-parents.mjs
 * Не редактировать вручную.
 */
export const CITY_PARENT: Record<string, string> = {
${body}
};
`;

fs.writeFileSync(OUT, file, "utf8");
console.log(`Записано ${entries.length} пар → lib/geo-agglomeration.ts`);
