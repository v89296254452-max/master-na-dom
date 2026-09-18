/**
 * Достраивает pages.csv до ПОЛНОЙ матрицы «город × услуга».
 * Берёт все уникальные города из существующего pages.csv и все 15 шаблонов
 * услуг (из PHONE_GROUPS), и для каждой недостающей пары создаёт страницу
 * через generatePage() (те же шаблоны h1/title/desc/цены/faq/районы).
 * Существующие строки не трогает — только дописывает новые.
 */
import { getAllPages } from "../lib/pages";
import { appendPagesToCsv, generatePage } from "../lib/page-generator";
import { PHONE_GROUPS, resolveTemplate } from "../lib/geo-import";
import type { ServiceTemplate } from "../lib/service-templates";

const FALLBACK_PHONE = "+7 (984) 333-32-49";

function main() {
  const pages = getAllPages();

  // существующие slug'и — чтобы не дублировать
  const existing = new Set(pages.map((p) => p.slug));

  // уникальные города: name + предложный + citySlug (из slug, срезая serviceSlug-)
  const cityMap = new Map<string, { name: string; prepositional: string; slug: string }>();
  for (const p of pages) {
    if (!p.city || !p.slug || !p.serviceSlug) continue;
    const prefix = `${p.serviceSlug}-`;
    if (!p.slug.startsWith(prefix)) continue;
    const citySlug = p.slug.slice(prefix.length);
    if (!citySlug) continue;
    if (!cityMap.has(citySlug)) {
      cityMap.set(citySlug, { name: p.city, prepositional: p.cityPrepositional || p.city, slug: citySlug });
    }
  }

  // 15 шаблонов услуг + их номера направлений (из PHONE_GROUPS)
  const templates = new Map<string, { tpl: ServiceTemplate; phone: string }>();
  for (const group of PHONE_GROUPS) {
    for (const sheet of group.sheets) {
      const tpl = resolveTemplate(sheet);
      if (!templates.has(tpl.slug)) templates.set(tpl.slug, { tpl, phone: group.phone });
    }
  }

  console.log(`Города: ${cityMap.size}, услуги-шаблоны: ${templates.size}, существующих страниц: ${pages.length}`);
  console.log(`Полная матрица: ${cityMap.size * templates.size}`);

  const newPages = [];
  for (const city of cityMap.values()) {
    for (const { tpl, phone } of templates.values()) {
      const slug = `${tpl.slug}-${city.slug}`;
      if (existing.has(slug)) continue;
      newPages.push(generatePage({ name: city.name, prepositional: city.prepositional, slug: city.slug, phone: phone || FALLBACK_PHONE }, tpl));
      existing.add(slug);
    }
  }

  console.log(`Новых страниц к добавлению: ${newPages.length}`);
  if (newPages.length === 0) { console.log("Матрица уже полная."); return; }

  const added = appendPagesToCsv(newPages);
  console.log(`Дописано ${added} страниц → data/pages.csv. Итого станет: ${pages.length + added}`);
}

main();
