import fs from "fs";
import path from "path";
import { getAllPages, getPhone, getServiceSlug, type Page } from "../lib/pages";

const SITE_URL = "https://master-na-dom.online";
const INPUT_PATH = path.join(process.cwd(), "data", "pages.csv");
const OUTPUT_PATH = path.join(process.cwd(), "data", "pages-registry.csv");

const CSV_COLUMNS = [
  "city",
  "service",
  "serviceSlug",
  "phone",
  "url",
  "slug",
  "title",
  "description",
] as const;

type RegistryColumn = (typeof CSV_COLUMNS)[number];

interface RegistryRow extends Record<RegistryColumn, string> {}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildRegistryRow(page: Page): RegistryRow | null {
  const slug = page.slug?.trim();
  if (!slug || !page.city?.trim()) {
    return null;
  }

  return {
    city: page.city.trim(),
    service: page.service?.trim() || "Услуга",
    serviceSlug: getServiceSlug(page),
    phone: getPhone(page.phone),
    url: `${SITE_URL}/${slug}`,
    slug,
    title: page.title?.trim() || "",
    description: page.description?.trim() || "",
  };
}

function rowsToCsv(rows: RegistryRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((row) =>
    CSV_COLUMNS.map((col) => escapeCsvField(row[col])).join(",")
  );
  return [header, ...body].join("\n") + "\n";
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Файл не найден: ${INPUT_PATH}`);
    process.exit(1);
  }

  const pages = getAllPages();
  const rows = pages
    .map(buildRegistryRow)
    .filter((row): row is RegistryRow => row !== null);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rowsToCsv(rows), "utf-8");

  console.log(`Источник: ${INPUT_PATH}`);
  console.log(`Прочитано строк: ${pages.length}`);
  console.log(`Записано строк: ${rows.length}`);
  console.log(`Файл: ${OUTPUT_PATH}`);
}

main();
