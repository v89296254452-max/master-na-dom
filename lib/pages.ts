import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { slugify } from "./transliterate";

export interface Page {
  slug: string;
  city: string;
  cityPrepositional: string;
  service: string;
  serviceSlug: string;
  phone: string;
  h1: string;
  title: string;
  description: string;
  price1: string;
  price2: string;
  price3: string;
  price4: string;
  faq1q: string;
  faq1a: string;
  faq2q: string;
  faq2a: string;
  faq3q: string;
  faq3a: string;
  districts: string;
}

export const FALLBACK_PHONE = "+7 (984) 333-32-49";

const CSV_PATH = path.join(process.cwd(), "data", "pages.csv");

function safeString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

export function getServiceSlug(page: Pick<Page, "serviceSlug" | "service">): string {
  const slug = safeString(page.serviceSlug);
  if (slug) {
    return slug;
  }
  const service = safeString(page.service);
  return service ? slugify(service) : "usluga";
}

export function getPhone(phone: unknown): string {
  return safeString(phone) || FALLBACK_PHONE;
}

function normalizePage(raw: Record<string, unknown>): Page {
  const service = safeString(raw.service);
  const city = safeString(raw.city);
  const cityPrepositional = safeString(raw.cityPrepositional) || city;
  const serviceSlug = safeString(raw.serviceSlug) || (service ? slugify(service) : "usluga");

  return {
    slug: safeString(raw.slug),
    city,
    cityPrepositional,
    service: service || "Услуга",
    serviceSlug,
    phone: getPhone(raw.phone),
    h1: safeString(raw.h1),
    title: safeString(raw.title),
    description: safeString(raw.description),
    price1: safeString(raw.price1),
    price2: safeString(raw.price2),
    price3: safeString(raw.price3),
    price4: safeString(raw.price4),
    faq1q: safeString(raw.faq1q),
    faq1a: safeString(raw.faq1a),
    faq2q: safeString(raw.faq2q),
    faq2a: safeString(raw.faq2a),
    faq3q: safeString(raw.faq3q),
    faq3a: safeString(raw.faq3a),
    districts: typeof raw.districts === "string" ? raw.districts : "",
  };
}

function loadPages(): Page[] {
  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  return rows.map(normalizePage);
}

export function getAllPages(): Page[] {
  return loadPages();
}

export function getPageBySlug(slug: string): Page | undefined {
  return loadPages().find((page) => page.slug === slug);
}

export function getOtherServicesInCity(page: Page): Page[] {
  if (!page.city) {
    return [];
  }

  return loadPages().filter(
    (p) => p.city === page.city && p.slug !== page.slug && p.slug && p.service
  );
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let state = hashString(seed);

  for (let i = arr.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export function getSameServiceInOtherCities(page: Page, limit = 10): Page[] {
  const serviceSlug = getServiceSlug(page);
  const others = loadPages().filter(
    (p) => getServiceSlug(p) === serviceSlug && p.slug !== page.slug && p.slug && p.city
  );

  return seededShuffle(others, page.slug || serviceSlug).slice(0, limit);
}

export function getPhoneHref(phone: unknown): string {
  return `tel:${getPhone(phone).replace(/[^\d+]/g, "")}`;
}

export function getDistrictsList(districts: unknown): string[] {
  if (typeof districts !== "string" || !districts.trim()) {
    return [];
  }

  const raw = districts.trim();
  const separator = raw.includes(";") ? ";" : ",";

  return raw.split(separator).map((d) => d.trim()).filter(Boolean);
}

export function getPrices(page: Page): string[] {
  return [page.price1, page.price2, page.price3, page.price4]
    .map((price) => safeString(price))
    .filter(Boolean);
}

export function getFaqs(page: Page): { question: string; answer: string }[] {
  return [
    { question: safeString(page.faq1q), answer: safeString(page.faq1a) },
    { question: safeString(page.faq2q), answer: safeString(page.faq2a) },
    { question: safeString(page.faq3q), answer: safeString(page.faq3a) },
  ].filter((faq) => faq.question && faq.answer);
}
