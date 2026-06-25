import type { Page } from "../pages";
import { getDistrictsList } from "../pages";

export interface ReviewItem {
  name: string;
  rating: number;
  text: string;
  district: string;
  date: string;
  service: string;
}

const NAMES = [
  "Александр", "Марина", "Дмитрий", "Елена", "Сергей", "Ольга", "Андрей", "Наталья",
  "Игорь", "Татьяна", "Павел", "Светлана", "Виктор", "Анна", "Михаил", "Юлия",
];

const REVIEW_TEMPLATES = [
  "Вызывал {serviceLower} в {district}. Мастер приехал быстро, всё починил за один визит. Рекомендую {brand}.",
  "Обратилась по рекомендации соседей. {service} в {city} — качественно и без лишних доплат. Спасибо!",
  "Срочно нужен был мастер — перезвонили через 3 минуты, приехали в течение часа. Работой доволен.",
  "Диагностика бесплатная, цену назвали до ремонта. Всё прозрачно, гарантийный талон выдали.",
  "Уже второй раз обращаюсь в {brand}. В {district} знают своё дело, вежливые мастера.",
  "Проблему устранили быстро, мусор за собой убрали. Оплата после проверки — очень удобно.",
  "Заказывала {serviceLower} на выходных — приняли заявку без проблем. Всё работает отлично.",
  "Хороший сервис: перезвонили заранее, приехали вовремя, объяснили причину поломки.",
  "Цена адекватная, запчасть была с собой. В {city} редко встретишь такой уровень сервиса.",
  "Мастер профессиональный, дал советы по эксплуатации. Буду обращаться снова.",
  "Обращался вечером — мастер приехал в тот же день. {service} выполнили аккуратно.",
  "Понравилось, что не навязывали лишние услуги. Честная диагностика и ремонт.",
];

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pick<T>(items: T[], seed: number, index: number): T {
  return items[(seed + index * 17) % items.length];
}

export function getServiceReviews(page: Page, count = 10): ReviewItem[] {
  const seed = hashSlug(page.slug || page.city || "default");
  const districts = getDistrictsList(page.districts);
  const districtFallback = districts.length ? districts : ["Центральный", "Советский", "Ленинский"];
  const service = page.service || "мастер";
  const serviceLower = service.toLowerCase();
  const city = page.city || "городе";
  const brand = "ПроМастер";

  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  return Array.from({ length: count }, (_, i) => {
    const template = pick(REVIEW_TEMPLATES, seed, i);
    const text = template
      .replace(/\{service\}/g, service)
      .replace(/\{serviceLower\}/g, serviceLower)
      .replace(/\{city\}/g, city)
      .replace(/\{district\}/g, pick(districtFallback, seed, i))
      .replace(/\{brand\}/g, brand);

    const rating = pick([4, 5, 5, 5, 5, 4, 5, 5, 4, 5], seed, i);
    const month = pick(months, seed, i + 3);
    const day = ((seed + i * 7) % 25) + 1;

    return {
      name: pick(NAMES, seed, i),
      rating,
      text,
      district: pick(districtFallback, seed, i + 1),
      date: `${day} ${month} 2025`,
      service,
    };
  });
}

export function getAverageRating(_page: Page): number {
  return 4.9;
}

export function getReviewCount(page: Page): number {
  const base = hashSlug(page.slug || "") % 40;
  return 120 + base;
}
