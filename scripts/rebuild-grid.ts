/**
 * Пересобирает data/pages.csv как ПОЛНУЮ матрицу «город × услуга» строго по
 * листам партнёрки из data/pulse.xlsx.
 *
 * Города берутся объединением всех офферных листов (статусы «Отключить»/
 * «Увеличить»/«Уменьшить» игнорируются — это состояние на сегодня, а сетка
 * должна быть полной). Услуги — все направления, которые закрывают листы:
 * один лист может давать два направления (лист «ВП» → варочные панели +
 * духовые шкафы). Телефоны распределяются по PHONE_GROUPS, как и раньше.
 *
 * Города и услуги, которых нет в Excel, из сетки исчезают — файл
 * перезаписывается целиком.
 */
import { createRequire } from "module";
import {
  PHONE_GROUPS,
  extractCities,
  findExcelFile,
  getSheetPhone,
  resolveTemplates,
  toPrepositional,
} from "../lib/geo-import";
import { generatePage, writePagesCsv } from "../lib/page-generator";
import type { ServiceTemplate } from "../lib/service-templates";
import { slugify } from "../lib/transliterate";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

interface CityEntry {
  name: string;
  prepositional: string;
  slug: string;
}

interface ServiceEntry {
  template: ServiceTemplate;
  phone: string;
  sheet: string;
}

function main() {
  const excelPath = process.argv[2] ?? findExcelFile();
  console.log(`Читаю файл: ${excelPath}\n`);

  const workbook = XLSX.readFile(excelPath);
  const offerSheets = new Set(PHONE_GROUPS.flatMap((group) => group.sheets));

  const cities = new Map<string, CityEntry>();
  const services = new Map<string, ServiceEntry>();
  const sheetsSeen: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = sheetName.trim();
    if (!offerSheets.has(sheet)) continue;

    const phone = getSheetPhone(sheet);
    if (!phone) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
    });

    const sheetCities = extractCities(rows.slice(1));
    sheetsSeen.push(`${sheet}: ${sheetCities.length} городов`);

    for (const name of sheetCities) {
      const slug = slugify(name);
      if (!slug || cities.has(slug)) continue;
      cities.set(slug, { name, prepositional: toPrepositional(name), slug });
    }

    for (const template of resolveTemplates(sheet)) {
      if (services.has(template.slug)) continue;
      services.set(template.slug, { template, phone, sheet });
    }
  }

  if (cities.size === 0 || services.size === 0) {
    throw new Error("Не удалось прочитать города/услуги из Excel — проверьте структуру файла.");
  }

  console.log("Листы партнёрки:");
  for (const line of sheetsSeen) console.log(`  ${line}`);

  console.log(`\nГорода (объединение листов): ${cities.size}`);
  console.log(`Направления сайта: ${services.size}`);
  console.log(`Полная матрица: ${cities.size} × ${services.size} = ${cities.size * services.size}\n`);

  const pages = [];
  for (const city of cities.values()) {
    for (const { template, phone } of services.values()) {
      pages.push(generatePage({ ...city, phone }, template));
    }
  }

  console.log("Направления и телефоны:");
  for (const { template, phone, sheet } of services.values()) {
    console.log(`  ${template.name} (${template.slug}) — лист ${sheet}, ${phone}`);
  }

  const byPhone = new Map<string, number>();
  for (const page of pages) byPhone.set(page.phone, (byPhone.get(page.phone) ?? 0) + 1);
  console.log("\nРаспределение по номерам:");
  for (const [phone, count] of byPhone) console.log(`  ${phone}: ${count} страниц`);

  const written = writePagesCsv(pages);
  console.log(`\nЗаписано ${written} страниц → data/pages.csv`);
}

main();
