/**
 * Текст оффера строго из СТРУКТУРИРОВАННЫХ данных страницы (service/serviceSlug/
 * city/cityPrepositional уже лежат в Page/BrandPage — см. lib/pages.ts,
 * lib/brand-pages.ts). Никакого парсинга H1/title строкой — только маппинг
 * по известному serviceSlug (их ровно 17, см. lib/offer-catalog.ts), чтобы
 * фраза была грамматически верной ("скидка на РАБОТУ сантехника", а не
 * «скидка на сантехник»). Бренд-страницы наследуют serviceSlug родителя —
 * попадают в ту же карту без доп. работы.
 */
const SERVICE_PHRASES: Record<string, string> = {
  santehnik: "работу сантехника",
  elektrik: "работу электрика",
  "master-na-chas": "мастера на час",
  "remont-okon": "ремонт окон",
  dezinfekciya: "дезинфекцию",
  klining: "клининг",
  "sborka-mebeli": "сборку мебели",
  kp: "компьютерную помощь",
  "remont-televizorov": "ремонт телевизоров",
  "remont-stiralnyh-mashin": "ремонт стиральных машин",
  "remont-holodilnikov": "ремонт холодильников",
  "remont-pmm": "ремонт посудомоечных машин",
  "remont-kondicionerov": "ремонт кондиционеров",
  "remont-kofemashin": "ремонт кофемашин",
  "remont-varochnyh-panelej": "ремонт варочных панелей",
  "remont-duhovyh-shkafov": "ремонт духовых шкафов",
  "remont-vodonagrevatelej": "ремонт водонагревателей",
};

export interface OfferContext {
  service?: string;
  serviceSlug?: string;
  city?: string;
  cityPrepositional?: string;
}

/** Приоритет: known serviceSlug → сырой service (lowercase) → generic-фолбэк. */
export function buildOfferSubject(ctx: OfferContext): string {
  if (ctx.serviceSlug && SERVICE_PHRASES[ctx.serviceSlug]) return SERVICE_PHRASES[ctx.serviceSlug];
  if (ctx.service) return ctx.service.toLowerCase();
  return "работу мастера";
}

export function buildOfferTitle(ctx: OfferContext, discountPercent: number): string {
  const subject = buildOfferSubject(ctx);
  const cityPart = ctx.cityPrepositional ? ` в ${ctx.cityPrepositional}` : "";
  return `Скидка ${discountPercent}% на ${subject}${cityPart}`;
}
