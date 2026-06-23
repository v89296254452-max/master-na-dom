export interface ServiceTemplate {
  slug: string;
  name: string;
  description: string;
  prices: [string, string, string, string];
  faqs: [{ q: string; a: string }, { q: string; a: string }, { q: string; a: string }];
  h1Suffix?: "default" | "hourly" | "repair";
}

export interface CityInput {
  name: string;
  prepositional: string;
  slug: string;
  phone: string;
}

export interface GeneratedPage {
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

export const DISTRICTS =
  "Центральный, Советский, Ленинский, Октябрьский, Железнодорожный, Промышленный";

export const BRAND = "ПроМастер";

function faqSet(serviceName: string, serviceLower: string) {
  return [
    {
      q: `Сколько стоит вызов ${serviceLower}?`,
      a: "Выезд и диагностика — бесплатно при выполнении работ. Точную стоимость назовёт мастер после осмотра.",
    },
    {
      q: "Как быстро приедет мастер?",
      a: "Мастер приедет в течение 30–60 минут по всему {cityPrep}.",
    },
    {
      q: "Даёте ли вы гарантию на работы?",
      a: "Да, гарантия на все виды работ — от 6 до 12 месяцев в зависимости от услуги.",
    },
  ] as ServiceTemplate["faqs"];
}

function repairTemplate(
  slug: string,
  name: string,
  description: string,
  prices: [string, string, string, string],
  faqs?: ServiceTemplate["faqs"]
): ServiceTemplate {
  return { slug, name, description, prices, faqs: faqs ?? faqSet(name, name.toLowerCase()), h1Suffix: "repair" };
}

const TEMPLATES: Record<string, ServiceTemplate> = {
  santehnik: repairTemplate(
    "santehnik",
    "Сантехник",
    "Устранение протечек, замена смесителей, прочистка канализации. Гарантия на работы.",
    [
      "Замена смесителя — от 800 ₽",
      "Устранение протечки — от 600 ₽",
      "Прочистка канализации — от 1 500 ₽",
      "Установка унитаза — от 2 000 ₽",
    ],
    [
      { q: "Сколько стоит вызов сантехника?", a: "Выезд и диагностика — бесплатно при выполнении работ. Минимальный заказ от 600 ₽." },
      { q: "Как быстро приедет мастер?", a: "Мастер приедет в течение 30–60 минут по всему {cityPrep}." },
      { q: "Даёте ли вы гарантию на работы?", a: "Да, гарантия на все виды работ — от 6 до 12 месяцев." },
    ]
  ),
  elektrik: repairTemplate(
    "elektrik",
    "Электрик",
    "Замена проводки, установка розеток, поиск неисправностей. Гарантия на работы.",
    [
      "Замена розетки — от 500 ₽",
      "Замена выключателя — от 400 ₽",
      "Поиск неисправности — от 800 ₽",
      "Установка люстры — от 700 ₽",
    ]
  ),
  "remont-stiralnyh-mashin": repairTemplate(
    "remont-stiralnyh-mashin",
    "Ремонт стиральных машин",
    "Samsung, LG, Bosch, Indesit и другие марки. Диагностика бесплатно. Гарантия на ремонт.",
    ["Диагностика — бесплатно", "Замена помпы — от 1 500 ₽", "Замена подшипников — от 3 000 ₽", "Ремонт модуля — от 2 500 ₽"]
  ),
  "remont-holodilnikov": repairTemplate(
    "remont-holodilnikov",
    "Ремонт холодильников",
    "Samsung, LG, Bosch, Atlant и другие марки. Диагностика бесплатно. Гарантия на ремонт.",
    ["Диагностика — бесплатно", "Заправка фреоном — от 2 000 ₽", "Замена термостата — от 1 200 ₽", "Замена компрессора — от 4 500 ₽"]
  ),
  "master-na-chas": {
    slug: "master-na-chas",
    name: "Мастер на час",
    description: "Мелкий ремонт, сборка мебели, навешивание полок. Выезд за 30 минут.",
    prices: ["Мастер на час — от 1 500 ₽/час", "Сборка мебели — от 800 ₽", "Навешивание полок — от 400 ₽", "Мелкий ремонт — от 500 ₽"],
    faqs: [
      { q: "Какие работы выполняет мастер на час?", a: "Сборка мебели, навешивание полок, мелкий сантехнический и электромонтажный ремонт." },
      { q: "Минимальное время заказа?", a: "Минимальный заказ — 1 час работы мастера." },
      { q: "Нужно ли покупать инструмент?", a: "Нет, мастер приезжает со всем необходимым инструментом." },
    ],
    h1Suffix: "hourly",
  },
  kp: repairTemplate(
    "kp",
    "Компьютерная помощь",
    "Настройка ПК, удаление вирусов, восстановление данных. Выезд мастера на дом.",
    ["Диагностика — бесплатно", "Настройка ПК — от 800 ₽", "Удаление вирусов — от 1 000 ₽", "Восстановление данных — от 1 500 ₽"]
  ),
  "remont-televizorov": repairTemplate(
    "remont-televizorov",
    "Ремонт телевизоров",
    "Ремонт LED, OLED, Smart TV. Диагностика бесплатно. Гарантия на ремонт.",
    ["Диагностика — бесплатно", "Замена блока питания — от 2 000 ₽", "Ремонт матрицы — от 3 500 ₽", "Настройка Smart TV — от 800 ₽"]
  ),
  "remont-kondicionerov": repairTemplate(
    "remont-kondicionerov",
    "Ремонт кондиционеров",
    "Обслуживание, заправка фреоном, ремонт сплит-систем. Гарантия на работы.",
    ["Диагностика — бесплатно", "Чистка кондиционера — от 1 500 ₽", "Заправка фреоном — от 2 500 ₽", "Ремонт компрессора — от 4 000 ₽"]
  ),
  "remont-kofemashin": repairTemplate(
    "remont-kofemashin",
    "Ремонт кофемашин",
    "DeLonghi, Saeco, Bosch, Jura и другие марки. Диагностика бесплатно.",
    ["Диагностика — бесплатно", "Чистка и декальцинация — от 1 200 ₽", "Замена помпы — от 2 000 ₽", "Ремонт заварочного блока — от 2 500 ₽"]
  ),
  "remont-vodonagrevatelej": repairTemplate(
    "remont-vodonagrevatelej",
    "Ремонт водонагревателей",
    "Ремонт бойлеров и проточных водонагревателей. Гарантия на работы.",
    ["Диагностика — бесплатно", "Замена ТЭНа — от 1 500 ₽", "Замена магниевого анода — от 800 ₽", "Ремонт термостата — от 1 200 ₽"]
  ),
  "remont-pmm": repairTemplate(
    "remont-pmm",
    "Ремонт посудомоечных машин",
    "Bosch, Siemens, Electrolux и другие марки. Диагностика бесплатно.",
    ["Диагностика — бесплатно", "Замена насоса — от 1 800 ₽", "Ремонт модуля — от 2 500 ₽", "Устранение протечки — от 1 200 ₽"]
  ),
  "remont-varochnyh-panelej": repairTemplate(
    "remont-varochnyh-panelej",
    "Ремонт варочных панелей",
    "Индукционные, электрические и газовые панели. Гарантия на ремонт.",
    ["Диагностика — бесплатно", "Замена конфорки — от 1 500 ₽", "Ремонт блока управления — от 2 500 ₽", "Замена стеклокерамики — от 4 000 ₽"]
  ),
  "remont-duhovyh-shkafov": repairTemplate(
    "remont-duhovyh-shkafov",
    "Ремонт духовых шкафов",
    "Электрические и газовые духовки. Диагностика бесплатно.",
    ["Диагностика — бесплатно", "Замена ТЭНа — от 1 500 ₽", "Ремонт термостата — от 1 200 ₽", "Замена вентилятора — от 1 800 ₽"]
  ),
  "remont-parovyh-shkafov": repairTemplate(
    "remont-parovyh-shkafov",
    "Ремонт паровых шкафов",
    "Samsung, LG и другие марки. Диагностика бесплатно.",
    ["Диагностика — бесплатно", "Чистка системы — от 1 500 ₽", "Ремонт нагревателя — от 2 500 ₽", "Замена насоса — от 2 000 ₽"]
  ),
  "remont-vinnyh-shkafov": repairTemplate(
    "remont-vinnyh-shkafov",
    "Ремонт винных шкафов",
    "Ремонт компрессора, термостата, устранение шума. Гарантия на работы.",
    ["Диагностика — бесплатно", "Замена термостата — от 1 500 ₽", "Ремонт компрессора — от 3 500 ₽", "Заправка фреоном — от 2 000 ₽"]
  ),
  "remont-gladilnyh-sistem": repairTemplate(
    "remont-gladilnyh-sistem",
    "Ремонт гладильных систем",
    "Philips, Laurastar и другие марки. Диагностика бесплатно.",
    ["Диагностика — бесплатно", "Чистка от накипи — от 1 000 ₽", "Замена подошвы — от 1 500 ₽", "Ремонт парогенератора — от 2 500 ₽"]
  ),
  "remont-massazhnyh-kresel": repairTemplate(
    "remont-massazhnyh-kresel",
    "Ремонт массажных кресел",
    "Ремонт механизма, электроники, обивки. Гарантия на работы.",
    ["Диагностика — бесплатно", "Ремонт механизма — от 2 500 ₽", "Замена блока управления — от 3 000 ₽", "Ремонт обивки — от 1 500 ₽"]
  ),
  "remont-okon": repairTemplate(
    "remont-okon",
    "Ремонт окон",
    "Регулировка фурнитуры, замена уплотнителя, устранение продувания.",
    ["Регулировка фурнитуры — от 500 ₽", "Замена уплотнителя — от 800 ₽", "Устранение продувания — от 600 ₽", "Замена стеклопакета — от 2 500 ₽"]
  ),
  "domashniy-remont": repairTemplate(
    "domashniy-remont",
    "Домашний ремонт",
    "Мелкий ремонт, отделка, сборка мебели. Выезд мастера на дом.",
    ["Мастер на час — от 1 500 ₽/час", "Сборка мебели — от 800 ₽", "Мелкий ремонт — от 500 ₽", "Отделочные работы — от 1 000 ₽"]
  ),
};

/** Лист Excel → slug шаблона */
export const SHEET_TO_TEMPLATE: Record<string, string> = {
  "КП": "kp",
  "Ремонт телевизоров": "remont-televizorov",
  "Кондиционеры": "remont-kondicionerov",
  "Холодильники": "remont-holodilnikov",
  "Ремонт кофемашин": "remont-kofemashin",
  "Водонагреватели": "remont-vodonagrevatelej",
  "ПММ": "remont-pmm",
  "Варочные панели": "remont-varochnyh-panelej",
  "Стиральные машины": "remont-stiralnyh-mashin",
  "Духовые шкафы": "remont-duhovyh-shkafov",
  "Паровые шкафы": "remont-parovyh-shkafov",
  "Ремонт винных шкафов": "remont-vinnyh-shkafov",
  "Ремонт гладильных систем": "remont-gladilnyh-sistem",
  "Ремонт массажных кресел": "remont-massazhnyh-kresel",
  "Окна": "remont-okon",
  "МнЧ": "master-na-chas",
  "Сантехник": "santehnik",
  "Электрик": "elektrik",
  "Домашний ремонт": "domashniy-remont",
};

export function getTemplateBySheet(sheetName: string): ServiceTemplate | null {
  const key = SHEET_TO_TEMPLATE[sheetName.trim()];
  if (!key) return null;
  return TEMPLATES[key] ?? null;
}

export function getTemplateBySlug(slug: string): ServiceTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function createGenericTemplate(sheetName: string, slug: string): ServiceTemplate {
  const name = sheetName.trim();
  return repairTemplate(
    slug,
    name,
    `Выезд мастера на дом в {cityPrep}. Диагностика и ремонт. Гарантия на работы.`,
    ["Диагностика — бесплатно", "Выезд мастера — от 500 ₽", "Мелкий ремонт — от 800 ₽", "Сложный ремонт — по смете"]
  );
}

export { TEMPLATES };
