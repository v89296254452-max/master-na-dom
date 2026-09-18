import type { Page } from "../pages";
import { getPrices, getServiceSlug } from "../pages";
import { getCityFacts } from "../city-facts";
import { getTemplateBySlug } from "../service-templates";
import { EXTENDED_PRICE_CATALOG } from "./price-catalog";

export interface PriceRow {
  name: string;
  value: string;
}

function parsePriceRow(price: string): PriceRow | null {
  if (!price?.trim()) return null;
  const separator = price.includes("—") ? "—" : "-";
  const parts = price.split(separator);
  if (parts.length >= 2) {
    return { name: parts[0].trim(), value: parts.slice(1).join(separator).trim() };
  }
  return { name: price.trim(), value: "" };
}

/**
 * Универсальные строки прайса — только то, что честно применимо к ЛЮБОЙ услуге.
 * Тех-специфичные позиции («ремонт платы», «чистка» и т.п.) вынесены в
 * EXTENDED_PRICE_CATALOG (lib/seo/price-catalog.ts, 50-150 позиций на услугу),
 * чтобы не показывать «ремонт платы» на странице сантехника.
 * Идут В КОНЦЕ списка — впереди всегда профильные работы услуги.
 */
const COMMON_ROWS: PriceRow[] = [
  { name: "Диагностика", value: "бесплатно при ремонте" },
  { name: "Выезд мастера", value: "от 500 ₽" },
  { name: "Срочный выезд", value: "от 800 ₽" },
  { name: "Работа вечером", value: "без доплат" },
  { name: "Работа в выходной", value: "без доплат" },
  { name: "Выезд за город", value: "от 40 ₽/км" },
  { name: "Гарантия", value: "до 12 месяцев" },
];

const GENERIC_APPLIANCE: PriceRow[] = [
  { name: "Замена детали", value: "от 1 500 ₽" },
  { name: "Замена ТЭНа/нагревателя", value: "от 1 500 ₽" },
  { name: "Ремонт модуля управления", value: "от 2 500 ₽" },
  { name: "Замена датчика", value: "от 1 400 ₽" },
  { name: "Устранение протечки", value: "от 1 200 ₽" },
];

/**
 * Локализация цены по коэффициенту города (price_coef из city-facts).
 * Раньше «от 600 ₽» было одинаково в Москве и в малом городе — и нереалистично,
 * и дубль-контент. Меняем только денежные значения: «бесплатно», «без доплат»,
 * «до 12 месяцев» остаются как есть.
 * Округляем до 10 (до 100 ₽) / до 50 (100–1000 ₽) / до 100 (от 1000 ₽).
 * Шаг 10 для сумм < 100 ₽ — иначе, например, «от 40 ₽/км» после умножения
 * на коэффициент города (0.8–1.3) почти всегда схлопывалось в плоские
 * «50 ₽» шагом-50 — терялась и точность, и сама межгородская разница.
 */
export function localizePrice(value: string, coef: number): string {
  if (!/₽|руб/i.test(value)) return value;
  if (!coef || Math.abs(coef - 1) < 0.01) return value;
  // Число с разделителями тысяч, БЕЗ хвостовых пробелов: шаблон \d[\d\s]* съедал
  // пробел перед «₽» и получалось «от 800₽».
  return value.replace(/\d+(?:[\s ]\d{3})*/, (m) => {
    const n = parseInt(m.replace(/[\s ]/g, ""), 10);
    if (!n) return m;
    const scaled = n * coef;
    const step = scaled >= 1000 ? 100 : scaled < 100 ? 10 : 50;
    const rounded = Math.max(step, Math.round(scaled / step) * step);
    return rounded.toLocaleString("ru-RU").replace(/ /g, " ");
  });
}

export function getExtendedPrices(page: Page): PriceRow[] {
  const serviceSlug = getServiceSlug(page);
  const csvRows = getPrices(page).map(parsePriceRow).filter((r): r is PriceRow => r !== null);
  const template = getTemplateBySlug(serviceSlug);
  const templateRows = (template?.prices ?? []).map(parsePriceRow).filter((r): r is PriceRow => r !== null);

  const specific =
    EXTENDED_PRICE_CATALOG[serviceSlug] ??
    (serviceSlug.startsWith("remont-") ? GENERIC_APPLIANCE : []);

  // Профильные работы услуги — впереди, универсальные строки — в конце.
  const merged = new Map<string, PriceRow>();
  for (const row of [...specific, ...templateRows, ...csvRows, ...COMMON_ROWS]) {
    if (row.name) merged.set(row.name.toLowerCase(), row);
  }

  // Коэффициент города применяется ЗДЕСЬ, в единой точке — поэтому видимые цены
  // и Offer/lowPrice в JSON-LD (они читают ту же функцию) всегда совпадают.
  const coef = getCityFacts(page.city || "")?.price_coef ?? 1;
  return Array.from(merged.values()).map((r) => ({ ...r, value: localizePrice(r.value, coef) }));
}
