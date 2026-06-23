import fs from "fs";
import path from "path";
import {
  BRAND,
  DISTRICTS,
  type CityInput,
  type GeneratedPage,
  type ServiceTemplate,
} from "./service-templates";

function interpolate(text: string, city: CityInput): string {
  return text
    .replace(/\{city\}/g, city.name)
    .replace(/\{cityPrep\}/g, city.prepositional);
}

export function generatePage(city: CityInput, service: ServiceTemplate): GeneratedPage {
  const slug = `${service.slug}-${city.slug}`;

  const h1 =
    service.h1Suffix === "hourly"
      ? `${service.name} в ${city.prepositional} — любые бытовые работы`
      : `${service.name} в ${city.prepositional} — выезд за 30 минут`;

  const isRepair =
    service.name.startsWith("Ремонт") ||
    service.h1Suffix === "repair" ||
    service.slug.startsWith("remont-");

  const title =
    isRepair || service.h1Suffix === "hourly"
      ? `${service.name} в ${city.prepositional} | ${BRAND}`
      : `${service.name} в ${city.prepositional} — вызов мастера на дом | ${BRAND}`;

  const description = `${service.name} в ${city.prepositional} с выездом на дом. ${service.description.replace("{cityPrep}", city.prepositional)} Звоните!`;

  const faqs = service.faqs.map((faq) => ({
    q: interpolate(faq.q, city),
    a: interpolate(faq.a, city),
  }));

  return {
    slug,
    city: city.name,
    cityPrepositional: city.prepositional,
    service: service.name,
    serviceSlug: service.slug,
    phone: city.phone,
    h1,
    title,
    description,
    price1: service.prices[0],
    price2: service.prices[1],
    price3: service.prices[2],
    price4: service.prices[3],
    faq1q: faqs[0].q,
    faq1a: faqs[0].a,
    faq2q: faqs[1].q,
    faq2a: faqs[1].a,
    faq3q: faqs[2].q,
    faq3a: faqs[2].a,
    districts: DISTRICTS,
  };
}

const CSV_COLUMNS: (keyof GeneratedPage)[] = [
  "slug",
  "city",
  "cityPrepositional",
  "service",
  "serviceSlug",
  "phone",
  "h1",
  "title",
  "description",
  "price1",
  "price2",
  "price3",
  "price4",
  "faq1q",
  "faq1a",
  "faq2q",
  "faq2a",
  "faq3q",
  "faq3a",
  "districts",
];

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function pageToCsvRow(page: GeneratedPage): string {
  return CSV_COLUMNS.map((col) => escapeCsvField(page[col])).join(",");
}

export function appendPagesToCsv(
  newPages: GeneratedPage[],
  outputPath?: string
): number {
  if (newPages.length === 0) {
    return 0;
  }

  const filePath = outputPath ?? path.join(process.cwd(), "data", "pages.csv");
  const rows = newPages.map(pageToCsvRow).join("\n") + "\n";

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, CSV_COLUMNS.join(",") + "\n" + rows, "utf-8");
    return newPages.length;
  }

  const existing = fs.readFileSync(filePath, "utf-8");
  const prefix = existing.endsWith("\n") ? "" : "\n";
  fs.appendFileSync(filePath, prefix + rows, "utf-8");
  return newPages.length;
}

export function pagesToCsv(pages: GeneratedPage[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = pages.map((page) =>
    CSV_COLUMNS.map((col) => escapeCsvField(page[col])).join(",")
  );
  return [header, ...rows].join("\n") + "\n";
}

export function writePagesCsv(pages: GeneratedPage[], outputPath?: string): number {
  const csv = pagesToCsv(pages);
  const filePath = outputPath ?? path.join(process.cwd(), "data", "pages.csv");
  fs.writeFileSync(filePath, csv, "utf-8");
  return pages.length;
}

export { CSV_COLUMNS, DISTRICTS, BRAND };
