import fs from "fs";
import path from "path";
import { getAllPages, getPhone, getServiceSlug, type Page } from "../lib/pages";
import { getSiteUrl } from "../lib/site";

const OUTPUT_PATH = path.join(process.cwd(), "data", "dzen-queue.csv");

const CSV_COLUMNS = [
  "city",
  "service",
  "service_title",
  "topic",
  "phone",
  "url",
  "status",
] as const;

const TOPICS_BY_SERVICE: Record<string, string[]> = {
  santehnik: [
    "Течет смеситель на кухне",
    "Засорилась раковина",
    "Протекает унитаз",
    "Слабый напор воды",
    "Потекла труба под раковиной",
  ],
  elektrik: [
    "Выбивает автомат в квартире",
    "Не работает розетка",
    "Мигает свет в комнате",
    "Искрит выключатель",
    "Нужно заменить проводку",
  ],
  "remont-stiralnyh-mashin": [
    "Стиральная машина не сливает воду",
    "Стиральная машина шумит при отжиме",
    "Стиральная машина не набирает воду",
    "Стиральная машина не открывает люк",
    "Стиральная машина течет снизу",
  ],
  "remont-holodilnikov": [
    "Холодильник не морозит",
    "Холодильник сильно шумит",
    "Холодильник течет внутри",
    "Не работает морозильная камера",
    "Холодильник постоянно включается",
  ],
  kp: [
    "Компьютер сильно тормозит",
    "Не включается ноутбук",
    "Нужно удалить вирусы",
    "Пропал интернет на компьютере",
    "Ноутбук перегревается",
  ],
};

const GENERIC_TOPICS = [
  "Когда стоит вызвать мастера",
  "Что можно проверить самостоятельно",
  "Частые причины поломки",
  "Как не усугубить проблему",
  "Когда ремонт лучше не откладывать",
];

interface DzenQueueRow {
  city: string;
  service: string;
  service_title: string;
  topic: string;
  phone: string;
  url: string;
  status: string;
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getTopicsForPage(page: Page): string[] {
  const serviceSlug = getServiceSlug(page);
  return TOPICS_BY_SERVICE[serviceSlug] ?? GENERIC_TOPICS;
}

function buildQueueRows(pages: Page[]): DzenQueueRow[] {
  const siteUrl = getSiteUrl();
  const rows: DzenQueueRow[] = [];

  for (const page of pages) {
    if (!page.slug || !page.city || !page.service) {
      continue;
    }

    const serviceSlug = getServiceSlug(page);
    const topics = getTopicsForPage(page);

    for (const topic of topics) {
      rows.push({
        city: page.city,
        service: serviceSlug,
        service_title: page.service,
        topic,
        phone: getPhone(page.phone),
        url: `${siteUrl}/${page.slug}`,
        status: "new",
      });
    }
  }

  return rows;
}

function rowsToCsv(rows: DzenQueueRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((row) =>
    CSV_COLUMNS.map((col) => escapeCsvField(row[col])).join(",")
  );
  return [header, ...body].join("\n") + "\n";
}

function main() {
  const pages = getAllPages().filter((page) => page.slug && page.city && page.service);
  const rows = buildQueueRows(pages);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rowsToCsv(rows), "utf-8");

  const cities = new Set(pages.map((page) => page.city));
  const services = new Set(pages.map((page) => getServiceSlug(page)));

  console.log(`Города: ${cities.size}`);
  console.log(`Услуги: ${services.size}`);
  console.log(`Строк CSV: ${rows.length}`);
  console.log(`Файл: ${OUTPUT_PATH}`);
}

main();
