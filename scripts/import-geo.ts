import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { cityIn } from "lvovich";
import { generatePage, writePagesCsv } from "../lib/page-generator";
import {
  SHEET_TO_TEMPLATE,
  createGenericTemplate,
  getTemplateBySheet,
  type GeneratedPage,
  type ServiceTemplate,
} from "../lib/service-templates";
import { slugify } from "../lib/transliterate";

const EXCEL_FILENAME = "ГЕО СЛ от 06.06.2026.xlsx";

const PHONE_GROUPS: { phone: string; sheets: string[] }[] = [
  {
    phone: "+7 (986) 089-07-04",
    sheets: ["КП", "Ремонт телевizоров"],
  },
  {
    phone: "+7 (969) 999-24-97",
    sheets: [
      "Кондиционеры",
      "Холодильники",
      "Ремонт кофемашин",
      "Водонагреватели",
      "ПММ",
      "Варочные панели",
      "Стиральные машины",
      "Духовые шкафы",
      "Паровые шкафы",
      "Ремонт винных шкафов",
      "Ремонт гладильных систем",
      "Ремонт массажных кресел",
    ],
  },
  {
    phone: "+7 (984) 333-32-49",
    sheets: ["Окна", "МнЧ", "Сантехник", "Электрик", "Домашний ремонт"],
  },
];

// fix typo in my write - телевizорov should be телевизоров
PHONE_GROUPS[0].sheets = ["КП", "Ремонт телевизоров"];

const SHEET_PHONE = new Map<string, string>();
for (const group of PHONE_GROUPS) {
  for (const sheet of group.sheets) {
    SHEET_PHONE.set(sheet, group.phone);
  }
}

const HEADER_PATTERN = /^(город|city|насел|№|#|id|название)/i;

function findExcelFile(): string {
  const dataDir = path.join(process.cwd(), "data");
  const exact = path.join(dataDir, EXCEL_FILENAME);

  if (fs.existsSync(exact)) {
    return exact;
  }

  const envPath = process.env.GEO_XLSX;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".xlsx") || f.endsWith(".xls"));
  if (files.length === 0) {
    throw new Error(
      `Excel-файл не найден. Положите "${EXCEL_FILENAME}" в папку data/`
    );
  }

  const geoFile = files.find((f) => f.toLowerCase().includes("гео") || f.toLowerCase().includes("geo"));
  return path.join(dataDir, geoFile ?? files[0]);
}

function toPrepositional(cityName: string): string {
  try {
    return cityIn(cityName);
  } catch {
    return cityName;
  }
}

function extractCities(rows: unknown[][]): string[] {
  const cities: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const raw = String(row[0] ?? "").trim();
    if (!raw || HEADER_PATTERN.test(raw)) continue;
    if (/^\d+$/.test(raw)) continue;

    const normalized = raw.replace(/\s+/g, " ");
    if (seen.has(normalized.toLowerCase())) continue;

    seen.add(normalized.toLowerCase());
    cities.push(normalized);
  }

  return cities;
}

function resolveTemplate(sheetName: string): ServiceTemplate {
  const trimmed = sheetName.trim();
  const existing = getTemplateBySheet(trimmed);

  if (existing) {
    return existing;
  }

  const templateKey = SHEET_TO_TEMPLATE[trimmed];
  const slug = templateKey ?? slugify(trimmed);
  return createGenericTemplate(trimmed, slug);
}

function importGeo(): GeneratedPage[] {
  const excelPath = findExcelFile();
  console.log(`Читаю файл: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);
  const pages: GeneratedPage[] = [];
  const slugSet = new Set<string>();

  let skippedSheets = 0;

  for (const sheetName of workbook.SheetNames) {
    const phone = SHEET_PHONE.get(sheetName.trim());

    if (!phone) {
      console.warn(`  ⚠ Лист "${sheetName}" пропущен — нет в группах номеров`);
      skippedSheets++;
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
    });

    const cities = extractCities(rows);
    const template = resolveTemplate(sheetName);

    console.log(`  ${sheetName}: ${cities.length} городов → ${template.name} (${phone})`);

    for (const cityName of cities) {
      const citySlug = slugify(cityName);
      const pageSlug = `${template.slug}-${citySlug}`;

      if (slugSet.has(pageSlug)) continue;
      slugSet.add(pageSlug);

      pages.push(
        generatePage(
          {
            name: cityName,
            prepositional: toPrepositional(cityName),
            slug: citySlug,
            phone,
          },
          template
        )
      );
    }
  }

  if (pages.length === 0) {
    throw new Error("Не удалось сгенерировать страницы. Проверьте структуру Excel-файла.");
  }

  console.log(`\nИтого: ${pages.length} страниц (пропущено листов: ${skippedSheets})`);
  return pages;
}

function main() {
  const pages = importGeo();
  const count = writePagesCsv(pages);
  console.log(`Сохранено ${count} страниц → data/pages.csv`);
}

main();
