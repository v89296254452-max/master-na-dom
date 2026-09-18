import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { cityIn } from "lvovich";
import { generatePage } from "./page-generator";
import {
  SHEET_TO_TEMPLATE,
  createGenericTemplate,
  getTemplateBySheet,
  getTemplatesBySheet,
  type GeneratedPage,
  type ServiceTemplate,
} from "./service-templates";
import { slugify } from "./transliterate";

export const EXCEL_FILENAME = "pulse.xlsx";

/**
 * Коллтрекинг по офферам партнёрки. Ключи — коды листов Excel.
 * Распределение сохранено с прошлого импорта: КП-номер на компьютеры и ТВ,
 * БТ-номер на ремонт бытовой техники, МнЧ-номер на все услуги мастеров.
 */
export const PHONE_GROUPS: { phone: string; sheets: string[] }[] = [
  {
    phone: "+7 (986) 089-07-04",
    sheets: ["ПК", "ТВ"],
  },
  {
    phone: "+7 (969) 999-24-97",
    sheets: ["СП", "ХД", "КМ", "БР", "ПМ", "ВП", "СМ"],
  },
  {
    phone: "+7 (984) 333-32-49",
    sheets: ["ОКНА", "МНЧ", "САН", "ЭЛ", "ДЕЗ", "КЛН", "МБ"],
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

  const geoFile = files.find((f) => {
    const name = f.toLowerCase();
    return name.includes("pulse") || name.includes("гео") || name.includes("geo");
  });
  return path.join(dataDir, geoFile ?? files[0]);
}

export function toPrepositional(cityName: string): string {
  try {
    return cityIn(cityName);
  } catch {
    return cityName;
  }
}

/**
 * В листах партнёрки город указан вместе с агломерацией: «Арамиль (Екатеринбург)».
 * Для страницы нужен только сам город. Скобка иногда не закрыта («Энгельс (Саратов»),
 * поэтому режем всё от первой открывающей скобки.
 */
export function normalizeCityName(raw: string): string {
  return String(raw)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\(.*$/, "")
    .trim();
}

export function extractCities(rows: unknown[][]): string[] {
  const cities: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const raw = String(row[0] ?? "").trim();
    if (!raw || HEADER_PATTERN.test(raw)) continue;

    const normalized = normalizeCityName(raw);
    // Служебные пометки статуса («✓», цифры) в колонке города — не города.
    if (!normalized || !/\p{L}/u.test(normalized)) continue;
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

/** Все направления сайта, которые закрывает лист (у «ВП» их два). */
export function resolveTemplates(sheetName: string): ServiceTemplate[] {
  const trimmed = sheetName.trim();
  const existing = getTemplatesBySheet(trimmed);

  if (existing.length > 0) {
    return existing;
  }

  return [resolveTemplate(trimmed)];
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

    const templates = resolveTemplates(sheetName);

    for (const template of templates) {
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
  }

  if (pages.length === 0) {
    throw new Error("Не удалось сгенерировать страницы. Проверьте структуру Excel-файла.");
  }

  return { pages, excelRowsFound, skippedSheets };
}

export function getSheetPhone(sheetName: string): string | undefined {
  return SHEET_PHONE.get(sheetName.trim());
}
