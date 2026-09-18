
import fs from "fs";
import path from "path";
import { getAllPages, getServiceSlug } from "../../lib/pages";
import { getCitySlug } from "../../lib/catalog";
import { getAiContent, getIndexableSlugSet } from "../../lib/ai-content";
import { getExtendedFaqs } from "../../lib/seo/faqs";
import { getExtendedPrices } from "../../lib/seo/prices";

const indexable = getIndexableSlugSet();
const rows: any[] = [];
for (const page of getAllPages()) {
  if (!page.slug) continue;
  if (indexable.has(page.slug)) continue; // only noindex
  const ai = getAiContent(page.slug);
  const paraCount = ai?.paragraphs?.length ?? 0;
  const faqs = getExtendedFaqs(page);
  const prices = getExtendedPrices(page);
  rows.push({
    slug: page.slug, city: page.city, service: page.service,
    paraCount,
    category: paraCount === 0 ? "NO_UNIQUE_TEXT" : "THIN",
    hasFAQ: faqs.length > 0, hasPrices: prices.length > 0,
  });
}
fs.writeFileSync(path.join(process.cwd(), "reports/noindex-categories.json"), JSON.stringify(rows), "utf-8");
const byCategory: Record<string, number> = {};
for (const r of rows) byCategory[r.category] = (byCategory[r.category]||0)+1;
console.error("total noindex SERVICE_CITY:", rows.length);
console.error("by category:", JSON.stringify(byCategory));
const paraDist: Record<number, number> = {};
for (const r of rows) paraDist[r.paraCount] = (paraDist[r.paraCount]||0)+1;
console.error("paragraph count distribution:", JSON.stringify(paraDist));
