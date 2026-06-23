import fs from "fs";
import path from "path";
import { getAllPages, getPhone, type Page } from "../lib/pages";

const SITE_URL = "https://master-na-dom.online";
const OUTPUT_PATH = path.join(process.cwd(), "data", "pages-registry.csv");

const CSV_COLUMNS = [
  "city",
  "service",
  "offerGroup",
  "phone",
  "slug",
  "url",
  "title",
  "description",
] as const;

const OFFER_GROUP_BY_PHONE: Record<string, string> = {
  "+7 (986) 089-07-04": "КП",
  "+7 (969) 999-24-97": "БТ",
  "+7 (984) 333-32-49": "МнЧ",
};

const OFFER_GROUP_BY_SERVICE_SLUG: Record<string, string> = {
  kp: "КП",
  "remont-televizorov": "КП",
  santehnik: "МнЧ",
  elektrik: "МнЧ",
  "master-na-chas": "МнЧ",
  "remont-okon": "МнЧ",
  "domashniy-remont": "МнЧ",
};

interface RegistryRow {
  city: string;
  service: string;
  offerGroup: string;
  phone: string;
  slug: string;
  url: string;
  title: string;
  description: string;
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getOfferGroup(page: Page): string {
  const phone = getPhone(page.phone);
  if (OFFER_GROUP_BY_PHONE[phone]) {
    return OFFER_GROUP_BY_PHONE[phone];
  }

  if (page.serviceSlug && OFFER_GROUP_BY_SERVICE_SLUG[page.serviceSlug]) {
    return OFFER_GROUP_BY_SERVICE_SLUG[page.serviceSlug];
  }

  return "БТ";
}

function buildRegistryRow(page: Page): RegistryRow | null {
  if (!page.slug || !page.city) {
    return null;
  }

  const slug = page.slug.trim();
  const phone = getPhone(page.phone);

  return {
    city: page.city,
    service: page.service || "Услуга",
    offerGroup: getOfferGroup(page),
    phone,
    slug,
    url: `${SITE_URL}/${slug}`,
    title: page.title || "",
    description: page.description || "",
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
  const pages = getAllPages();
  const rows = pages
    .map(buildRegistryRow)
    .filter((row): row is RegistryRow => row !== null);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rowsToCsv(rows), "utf-8");

  console.log(`Прочитано строк: ${pages.length}`);
  console.log(`Записано строк: ${rows.length}`);
  console.log(`Файл: ${OUTPUT_PATH}`);
}

main();
