import type { Page } from "../pages";
import { getPrices, getServiceSlug } from "../pages";
import { getTemplateBySlug } from "../service-templates";

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

/** Общие строки прайса — минимум 20 позиций после merge */
const COMMON_ROWS: PriceRow[] = [
  { name: "Диагностика", value: "бесплатно при ремонте" },
  { name: "Выезд мастера", value: "от 500 ₽" },
  { name: "Замена детали", value: "от 1 200 ₽" },
  { name: "Настройка", value: "от 800 ₽" },
  { name: "Чистка", value: "от 1 000 ₽" },
  { name: "Ремонт платы", value: "от 2 500 ₽" },
  { name: "Профилактика", value: "от 1 200 ₽" },
  { name: "Срочный выезд", value: "от 800 ₽" },
  { name: "Работа вечером", value: "без доплат" },
  { name: "Работа в выходной", value: "без доплат" },
  { name: "Выезд за город", value: "от 500 ₽/км" },
  { name: "Гарантия", value: "до 12 месяцев" },
];

const EXTENDED_BY_SERVICE: Record<string, PriceRow[]> = {
  santehnik: [
    { name: "Устранение протечки", value: "от 600 ₽" },
    { name: "Замена смесителя", value: "от 800 ₽" },
    { name: "Прочистка канализации", value: "от 1 500 ₽" },
    { name: "Установка унитаза", value: "от 2 000 ₽" },
    { name: "Замена сифона", value: "от 700 ₽" },
    { name: "Замена стояка", value: "от 2 500 ₽" },
    { name: "Замена труб", value: "от 1 500 ₽" },
    { name: "Подключение стиральной машины", value: "от 800 ₽" },
  ],
  elektrik: [
    { name: "Замена розетки", value: "от 500 ₽" },
    { name: "Замена выключателя", value: "от 400 ₽" },
    { name: "Установка люстры", value: "от 700 ₽" },
    { name: "Поиск неисправности", value: "от 800 ₽" },
    { name: "Замена автомата", value: "от 800 ₽" },
    { name: "Прокладка проводки", value: "от 300 ₽/м" },
    { name: "Подключение плиты", value: "от 1 500 ₽" },
    { name: "Заземление", value: "от 1 200 ₽" },
  ],
  "remont-holodilnikov": [
    { name: "Замена термостата", value: "от 1 200 ₽" },
    { name: "Заправка фреоном", value: "от 2 000 ₽" },
    { name: "Замена компрессора", value: "от 4 500 ₽" },
    { name: "Ремонт платы управления", value: "от 2 500 ₽" },
    { name: "Чистка No Frost", value: "от 1 500 ₽" },
    { name: "Замена уплотнителя", value: "от 900 ₽" },
    { name: "Замена вентилятора", value: "от 1 800 ₽" },
    { name: "Замена датчика", value: "от 1 400 ₽" },
  ],
  "remont-stiralnyh-mashin": [
    { name: "Замена помпы", value: "от 1 500 ₽" },
    { name: "Замена подшипников", value: "от 3 000 ₽" },
    { name: "Замена ТЭНа", value: "от 1 200 ₽" },
    { name: "Ремонт модуля", value: "от 2 500 ₽" },
    { name: "Замена манжеты люка", value: "от 1 500 ₽" },
    { name: "Замена ремня", value: "от 1 000 ₽" },
    { name: "Чистка фильтра", value: "от 800 ₽" },
    { name: "Замена амортизаторов", value: "от 1 800 ₽" },
  ],
  kp: [
    { name: "Настройка ПК", value: "от 800 ₽" },
    { name: "Удаление вирусов", value: "от 1 000 ₽" },
    { name: "Восстановление данных", value: "от 1 500 ₽" },
    { name: "Установка Windows", value: "от 1 200 ₽" },
    { name: "Настройка Wi-Fi", value: "от 800 ₽" },
    { name: "Чистка ноутбука", value: "от 1 000 ₽" },
    { name: "Установка программ", value: "от 600 ₽" },
    { name: "Замена HDD на SSD", value: "от 1 500 ₽" },
  ],
};

const GENERIC_APPLIANCE: PriceRow[] = [
  { name: "Замена насоса", value: "от 1 800 ₽" },
  { name: "Замена ТЭНа", value: "от 1 500 ₽" },
  { name: "Ремонт модуля", value: "от 2 500 ₽" },
  { name: "Устранение протечки", value: "от 1 200 ₽" },
];

export function getExtendedPrices(page: Page): PriceRow[] {
  const serviceSlug = getServiceSlug(page);
  const csvRows = getPrices(page).map(parsePriceRow).filter((r): r is PriceRow => r !== null);
  const template = getTemplateBySlug(serviceSlug);
  const templateRows = (template?.prices ?? []).map(parsePriceRow).filter((r): r is PriceRow => r !== null);

  const specific =
    EXTENDED_BY_SERVICE[serviceSlug] ??
    (serviceSlug.startsWith("remont-") ? GENERIC_APPLIANCE : []);

  const merged = new Map<string, PriceRow>();
  for (const row of [...COMMON_ROWS, ...specific, ...templateRows, ...csvRows]) {
    if (row.name) merged.set(row.name.toLowerCase(), row);
  }

  return Array.from(merged.values());
}
