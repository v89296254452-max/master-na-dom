import type { Page } from "../pages";
import { getServiceSlug } from "../pages";

export interface ServiceCase {
  title: string;
  problem: string;
  solution: string;
  price: string;
  duration: string;
}

const CASES_BY_SERVICE: Record<string, ServiceCase[]> = {
  "remont-holodilnikov": [
    { title: "Ремонт холодильника Bosch", problem: "Не морозит морозилка", solution: "Замена термостата", price: "от 2 800 ₽", duration: "1,5 ч" },
    { title: "Заправка фреоном Atlant", problem: "Слабое охлаждение", solution: "Поиск утечки и заправка", price: "от 3 200 ₽", duration: "2 ч" },
    { title: "Ремонт No Frost Samsung", problem: "Намерзает лёд", solution: "Чистка дренажа и датчика", price: "от 2 500 ₽", duration: "1,5 ч" },
    { title: "Замена компрессора LG", problem: "Не запускается", solution: "Замена компрессора", price: "от 6 500 ₽", duration: "2,5 ч" },
  ],
  "remont-stiralnyh-mashin": [
    { title: "Замена ТЭНа", problem: "Не греет воду", solution: "Замена нагревателя", price: "от 2 400 ₽", duration: "1,5 ч" },
    { title: "Замена помпы Indesit", problem: "Не сливает воду", solution: "Замена сливного насоса", price: "от 2 800 ₽", duration: "1 ч" },
    { title: "Ремонт подшипников Bosch", problem: "Шум при отжиме", solution: "Замена подшипникового узла", price: "от 4 500 ₽", duration: "2 ч" },
    { title: "Замена манжеты люка", problem: "Течёт снизу", solution: "Установка новой манжеты", price: "от 2 200 ₽", duration: "1 ч" },
  ],
  santehnik: [
    { title: "Замена смесителя", problem: "Течёт кран на кухне", solution: "Монтаж нового смесителя", price: "от 1 200 ₽", duration: "40 мин" },
    { title: "Прочистка канализации", problem: "Засор в раковине", solution: "Механическая прочистка", price: "от 1 800 ₽", duration: "1 ч" },
    { title: "Замена сифона", problem: "Запах из раковины", solution: "Замена сифона и прокладок", price: "от 900 ₽", duration: "30 мин" },
    { title: "Устранение протечки стояка", problem: "Капает с потолка", solution: "Замена соединения", price: "от 1 500 ₽", duration: "1 ч" },
  ],
  elektrik: [
    { title: "Замена автомата", problem: "Выбивает при включении плиты", solution: "Замена автомата и проверка линии", price: "от 1 400 ₽", duration: "1 ч" },
    { title: "Замена розетки", problem: "Искрит розетка", solution: "Замена механизма и проводки", price: "от 700 ₽", duration: "30 мин" },
    { title: "Установка люстры", problem: "Нет освещения в комнате", solution: "Монтаж и подключение", price: "от 900 ₽", duration: "45 мин" },
    { title: "Поиск обрыва", problem: "Не работает группа розеток", solution: "Диагностика и восстановление", price: "от 1 800 ₽", duration: "1,5 ч" },
  ],
  kp: [
    { title: "Удаление вирусов", problem: "Реклама и тормоза", solution: "Очистка и настройка системы", price: "от 1 200 ₽", duration: "1,5 ч" },
    { title: "Установка Windows", problem: "Не загружается система", solution: "Переустановка с сохранением данных", price: "от 1 500 ₽", duration: "2 ч" },
    { title: "Настройка Wi-Fi", problem: "Нет интернета", solution: "Настройка роутера", price: "от 900 ₽", duration: "40 мин" },
    { title: "Чистка ноутбука", problem: "Перегревается и шумит", solution: "Чистка системы охлаждения", price: "от 1 200 ₽", duration: "1 ч" },
  ],
};

const GENERIC_CASES: ServiceCase[] = [
  { title: "Диагностика на дому", problem: "Неисправность техники", solution: "Осмотр и согласование ремонта", price: "бесплатно*", duration: "30 мин" },
  { title: "Срочный выезд", problem: "Срочная поломка", solution: "Приоритетный выезд мастера", price: "от 800 ₽", duration: "1 ч" },
  { title: "Профилактика", problem: "Плановое обслуживание", solution: "Чистка и проверка узлов", price: "от 1 200 ₽", duration: "1,5 ч" },
  { title: "Замена детали", problem: "Износ комплектующих", solution: "Установка новой запчасти", price: "от 1 500 ₽", duration: "1 ч" },
];

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getServiceCases(page: Page, count = 4): ServiceCase[] {
  const serviceSlug = getServiceSlug(page);
  const pool = CASES_BY_SERVICE[serviceSlug] ?? GENERIC_CASES;
  const seed = hashSlug(page.slug || serviceSlug);

  const picked: ServiceCase[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    picked.push(pool[(seed + i * 3) % pool.length]);
  }

  return picked;
}
