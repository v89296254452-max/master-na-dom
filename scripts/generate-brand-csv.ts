import fs from "fs";
import path from "path";
import { getBrandPageBySlug, getAllBrandPageSlugs } from "../lib/brand-pages";

/** Плоский CSV бренд-страниц для ИИ-генерации (slug,service,brand,city,cityDat). */
const OUT = path.join(process.cwd(), "data", "brand-pages.csv");
const COLS = ["slug", "service", "serviceSlug", "brand", "city", "cityDat"];

function esc(v: string): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const rows: string[] = [COLS.join(",")];
let n = 0;
for (const slug of getAllBrandPageSlugs()) {
  const bp = getBrandPageBySlug(slug);
  if (!bp) continue;
  rows.push([bp.slug, bp.service, bp.serviceSlug, bp.brand, bp.city, bp.cityDat].map(esc).join(","));
  n++;
}
fs.writeFileSync(OUT, rows.join("\n") + "\n", "utf-8");
console.log(`Бренд-страниц: ${n}. Файл: ${OUT}`);
