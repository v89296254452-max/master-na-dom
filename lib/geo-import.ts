import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { cityIn } from "lvovich";
import { generatePage } from "./page-generator";
import {
  SHEET_TO_TEMPLATE,
  createGenericTemplate,
  getTemplateBySheet,
  type GeneratedPage,
  type ServiceTemplate,
} from "./service-templates";
import { slugify } from "./transliterate";

export const EXCEL_FILENAME = "ГЕО СЛ от 06.06.2026.xlsx";

export const PHONE_GROUPS: { phone: string; sheets: string[] }[] = [
  {
    phone: "+7 (986) 089-07-04",
    sheets: ["КП", "Ремонт телевизоров"],
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

const SHEET_PHONE = new Map<string, string>();
for (const group of PHONE_GROUPS) {
  for (const sheet of group.sheets) {
    SHEET_PHONE.set(sheet, group.phone);
  }
}

const HEADER_PATTERN = /^(город|city|насел|№|#|id|название)/i;

export interface GeoImportResult {
  pages: GeneratedPage[];
  excelRowsFound: number;
  skippedSheets: number;
}

export function findExcelFile(): string {
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

export function toPrepositional(cityName: string): string {
  try {
    return cityIn(cityName);
  } catch {
    return cityName;
  }
}

export function extractCities(rows: unknown[][]): string[] {
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

export function resolveTemplate(sheetName: string): ServiceTemplate {
  const trimmed = sheetName.trim();
  const existing = getTemplateBySheet(trimmed);

  if (existing) {
    return existing;
  }

  const templateKey = SHEET_TO_TEMPLATE[trimmed];
  const slug = templateKey ?? slugify(trimmed);
  return createGenericTemplate(trimmed, slug);
}

export function loadGeoPagesFromExcel(excelPath?: string): GeoImportResult {
  const filePath = excelPath ?? findExcelFile();
  const workbook = XLSX.readFile(filePath);
  const pages: GeneratedPage[] = [];
  const slugSet = new Set<string>();
  let excelRowsFound = 0;
  let skippedSheets = 0;

  for (const sheetName of workbook.SheetNames) {
    const phone = SHEET_PHONE.get(sheetName.trim());

    if (!phone) {
      skippedSheets++;
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
    });

    const cities = extractCities(allRows.slice(1));
    excelRowsFound += cities.length;

    const template = resolveTemplate(sheetName);

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

  return { pages, excelRowsFound, skippedSheets };
}

export function getSheetPhone(sheetName: string): string | undefined {
  return SHEET_PHONE.get(sheetName.trim());
}
