import { getAllCities, getAllServices, getCitySlug } from "@/lib/catalog";
import { COMPANY } from "@/lib/company";
import { getAllPages, getServiceSlug, type Page } from "@/lib/pages";
import { getMasters } from "@/lib/seo/masters";
import { getExtendedPrices } from "@/lib/seo/prices";
import { getRealAggregate } from "@/lib/seo/real-reviews";
import { getSiteUrl } from "@/lib/site";

/**
 * YML-фид «Исполнители» для Яндекс.Вебмастера:
 * Услуги и предложения в поиске → категория «Исполнители».
 * https://yandex.ru/support/webmaster/ru/search-appearance/services.html
 *
 * Сеты = страницы-списки (/uslugi/{service}, /goroda/{city}) — обогащается
 * сниппет URL, совпадающий с URL сета. Оффер = гео-лендинг услуги в городе.
 */
export const YML_FEED_PATH = "/feed.yml";
export const YML_FEED_ALIAS_PATH = "/offers.yml";
export const MAX_YML_OFFERS = 30_000;

/** Категории из справки Вебмастера (исполнители). */
const CATEGORY_TREE: { id: number; parentId?: number; name: string }[] = [
  { id: 1, name: "Исполнитель" },
  { id: 11, parentId: 1, name: "Ремонт и строительство" },
  { id: 12, parentId: 1, name: "Ремонт и установка техники" },
  { id: 17, parentId: 1, name: "Хозяйство и уборка" },
  { id: 18, parentId: 1, name: "Компьютеры и IT" },
  { id: 29, parentId: 1, name: "Разное" },
  { id: 101, parentId: 11, name: "Ремонт квартир и домов" },
  { id: 102, parentId: 11, name: "Окна и балконы" },
  { id: 104, parentId: 11, name: "Сантехнические работы и отопление" },
  { id: 105, parentId: 11, name: "Электромонтажные работы" },
  { id: 112, parentId: 12, name: "Кондиционеры" },
  { id: 113, parentId: 12, name: "Холодильники" },
  { id: 114, parentId: 12, name: "Стиральные машины" },
  { id: 115, parentId: 12, name: "Посудомоечные машины" },
  { id: 116, parentId: 12, name: "Кухонные плиты" },
];

const SERVICE_CATEGORY: Record<string, number> = {
  santehnik: 104,
  elektrik: 105,
  "master-na-chas": 101,
  "remont-okon": 102,
  dezinfekciya: 17,
  klining: 17,
  "sborka-mebeli": 101,
  kp: 18,
  "remont-televizorov": 12,
  "remont-stiralnyh-mashin": 114,
  "remont-holodilnikov": 113,
  "remont-pmm": 115,
  "remont-kondicionerov": 112,
  "remont-kofemashin": 12,
  "remont-varochnyh-panelej": 116,
  "remont-duhovyh-shkafov": 116,
  "remont-vodonagrevatelej": 12,
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function catalogDate(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** Первое денежное число из строки прайса («от 1 200 ₽» → 1200). */
function parsePriceNumber(value: string): number | null {
  const v = value || "";
  if (!/₽|руб/i.test(v)) return null;
  const digits = v.replace(/\s/g, "").match(/\d+/);
  return digits ? parseInt(digits[0], 10) : null;
}

function minPriceFromPage(page: Page): number {
  const prices = getExtendedPrices(page)
    .map((r) => parsePriceNumber(r.value))
    .filter((n): n is number => n !== null && n > 0);
  return prices.length ? Math.min(...prices) : 500;
}

function categoryIdFor(serviceSlug: string): number {
  return SERVICE_CATEGORY[serviceSlug] ?? 29;
}

function usedCategoryXml(usedIds: Set<number>): string {
  const include = new Set<number>();
  for (const id of usedIds) {
    let cur: number | undefined = id;
    while (cur) {
      include.add(cur);
      const node = CATEGORY_TREE.find((c) => c.id === cur);
      cur = node?.parentId;
    }
  }
  return CATEGORY_TREE.filter((c) => include.has(c.id))
    .map((c) =>
      c.parentId
        ? `<category id="${c.id}" parentId="${c.parentId}">${xmlEscape(c.name)}</category>`
        : `<category id="${c.id}">${xmlEscape(c.name)}</category>`
    )
    .join("");
}

function param(name: string, value: string | number, unit?: string): string {
  const unitAttr = unit ? ` unit="${xmlEscape(unit)}"` : "";
  return `<param name="${xmlEscape(name)}"${unitAttr}>${xmlEscape(String(value))}</param>`;
}

function offerXml(page: Page, id: number, siteUrl: string): string {
  const serviceSlug = getServiceSlug(page);
  const citySlug = getCitySlug(page);
  const cityPrep = page.cityPrepositional || page.city;
  // Персона мастера (детерминирована по slug страницы — та же логика,
  // что и для карточек команды на сайте). getMasters()[i].img всегда равен
  // `master-${i+1}` (привязано к позиции в массиве, не к хешу) — если брать
  // фиксированный индекс, фото будет одно и то же на всех страницах, хотя
  // имя различается. Поэтому индекс тоже выбираем по хешу. Имя оффера всё
  // равно включает услугу+город, чтобы гарантированно не повторяться внутри
  // одного сета (Вебмастер запрещает повтор имени исполнителя в сете).
  const masters = getMasters(page.slug);
  const master = masters[hashString(`pic-${page.slug}`) % masters.length];
  const name = `${master.n} — ПроМастер, ${page.service} в ${page.city}`;
  const url = `${siteUrl}/${page.slug}`;
  const picture = `${siteUrl}/images/promaster/${master.img}.jpg`;
  const description =
    (page.description || "").trim() ||
    `${page.service} в ${cityPrep}. Выезд мастера на дом, диагностика, ремонт.`;
  const price = minPriceFromPage(page);
  const agg = getRealAggregate(page.city, serviceSlug);
  const rating = agg ? agg.ratingValue : "0";
  const reviews = agg ? agg.reviewCount : 0;

  return (
    `<offer id="${id}" available="true">` +
    `<name>${xmlEscape(name)}</name>` +
    `<url>${xmlEscape(url)}</url>` +
    `<price from="true">${price}</price>` +
    `<currencyId>RUR</currencyId>` +
    `<categoryId>${categoryIdFor(serviceSlug)}</categoryId>` +
    `<set-ids>${xmlEscape(`s-${serviceSlug},c-${citySlug}`)}</set-ids>` +
    `<picture>${xmlEscape(picture)}</picture>` +
    `<description>${xmlEscape(description.slice(0, 3000))}</description>` +
    `<sales_notes>Точная стоимость после диагностики. Выезд бесплатно при ремонте.</sales_notes>` +
    param("Рейтинг", rating) +
    param("Число отзывов", reviews) +
    param("Годы опыта", COMPANY.yearsOnMarket) +
    param("Регион", page.city) +
    param("Конверсия", 1) +
    // Вебмастер требует URL (https), не tel:+7… — иначе PARAM_VALUE_INVALID_TYPE.
    param("Ссылка на телефон", `${siteUrl}/kontakty`) +
    param("Организация", "true") +
    param("Выполняется по адресу заказчика", "true") +
    param("Выполняется удаленно", serviceSlug === "kp" ? "true" : "false") +
    param(
      "Об исполнителе",
      `Сервис ПроМастер: ${page.service.toLowerCase()} в ${cityPrep}. Работаем ${COMPANY.yearsOnMarket} лет, выезд от 30 минут.`
    ) +
    `</offer>`
  );
}

export function renderYmlServicesFeed(): string {
  const siteUrl = getSiteUrl();
  const pages = getAllPages()
    .filter((p) => p.slug && p.city && p.service)
    .slice(0, MAX_YML_OFFERS);

  const services = getAllServices();
  const cities = getAllCities();

  const sets =
    services
      .map(
        (s) =>
          `<set id="${xmlEscape(`s-${s.serviceSlug}`)}">` +
          `<name>${xmlEscape(`${s.service} — мастера ПроМастер по городам`)}</name>` +
          `<url>${xmlEscape(`${siteUrl}/uslugi/${s.serviceSlug}`)}</url>` +
          `</set>`
      )
      .join("") +
    cities
      .map(
        (c) =>
          `<set id="${xmlEscape(`c-${c.citySlug}`)}">` +
          `<name>${xmlEscape(`Мастер на дом в ${c.cityPrepositional}`)}</name>` +
          `<url>${xmlEscape(`${siteUrl}/goroda/${c.citySlug}`)}</url>` +
          `</set>`
      )
      .join("");

  const usedCats = new Set(pages.map((p) => categoryIdFor(getServiceSlug(p))));
  const offers = pages.map((p, i) => offerXml(p, i + 1, siteUrl)).join("");
  const company = COMPANY.legalName || COMPANY.brand;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<yml_catalog date="${catalogDate()}">` +
    `<shop>` +
    `<name>${xmlEscape(COMPANY.brand)}</name>` +
    `<company>${xmlEscape(company)}</company>` +
    `<url>${xmlEscape(siteUrl)}</url>` +
    `<email>${xmlEscape(COMPANY.email)}</email>` +
    `<currencies><currency id="RUR" rate="1"/></currencies>` +
    `<categories>${usedCategoryXml(usedCats)}</categories>` +
    `<sets>${sets}</sets>` +
    `<offers>${offers}</offers>` +
    `</shop>` +
    `</yml_catalog>`
  );
}

export function ymlServicesFeedResponse(): Response {
  return new Response(renderYmlServicesFeed(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
    },
  });
}
