import { DEFAULT_PHONE } from "./phones";
import { CONTACT_EMAIL } from "./offices";
import { OFFER_CITIES } from "./offer-catalog";

/**
 * Единые данные компании. Юр-реквизиты и соцсети берутся из env, чтобы
 * подставить их без правки кода. Пустые поля страницы просто не показывают.
 *   ORG_LEGAL_NAME="ИП Иванов Иван Иванович"
 *   ORG_INN="1234567890"   ORG_OGRN="000000000000"
 *   ORG_ADDRESS="г. Москва, ул. ..."
 *   ORG_HOURS="Круглосуточно, без выходных"
 *   ORG_VK="https://vk.com/..."  ORG_DZEN="https://dzen.ru/..."
 *   ORG_TELEGRAM="https://t.me/..."  ORG_WHATSAPP="https://wa.me/7..."
 */
export const COMPANY = {
  brand: "ПроМастер",
  domain: "master-na-dom.online",
  email: CONTACT_EMAIL,
  phone: DEFAULT_PHONE,
  yearsOnMarket: 9,
  clients: "50 000+",
  citiesCount: OFFER_CITIES.length,

  legalName: process.env.ORG_LEGAL_NAME || "",
  inn: process.env.ORG_INN || "",
  ogrn: process.env.ORG_OGRN || "",
  address: process.env.ORG_ADDRESS || "",
  hours: process.env.ORG_HOURS || "Круглосуточно, 7 дней в неделю",

  vk: process.env.ORG_VK || "",
  dzen: process.env.ORG_DZEN || "",
  telegram: process.env.ORG_TELEGRAM || "",
  whatsapp: process.env.ORG_WHATSAPP || "",
};

/** Автор-эксперт блога — для E-E-A-T (Person в Article-schema + подпись). */
export const BLOG_AUTHOR = {
  name: "Артём Соколов",
  role: "старший инженер сервисной службы ПроМастер",
  bio: "12 лет в ремонте бытовой техники, сантехники и электрики. Прошёл сотни выездов, отвечает за обучение мастеров и стандарты качества.",
};

/** Ссылки на соцсети/мессенджеры, которые заданы (для футера и sameAs). */
export function companySocials(): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  if (COMPANY.vk) out.push({ label: "ВКонтакте", href: COMPANY.vk });
  if (COMPANY.dzen) out.push({ label: "Дзен", href: COMPANY.dzen });
  if (COMPANY.telegram) out.push({ label: "Telegram", href: COMPANY.telegram });
  if (COMPANY.whatsapp) out.push({ label: "WhatsApp", href: COMPANY.whatsapp });
  return out;
}
