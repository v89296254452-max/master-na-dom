import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { FALLBACK_PHONE, getPageBySlug, getServiceSlug } from "./pages";

/**
 * Кластер «Услуга + Проблема + Город».
 * Источник данных: data/problems-cluster.csv (генерируется
 * scripts/generate-problems-cluster.ts из data/pages.csv).
 *
 * Каждая строка кластера соответствует «родительской» странице услуги
 * из data/pages.csv: parentSlug = slug без суффикса `-{problemSlug}`.
 */

export interface ProblemDef {
  problemSlug: string;
  problem: string;
}

/** Матрица проблем по serviceSlug (как в data/pages.csv) */
export const PROBLEM_MATRIX: Record<string, ProblemDef[]> = {
  santehnik: [
    { problemSlug: "techet-kran", problem: "течёт кран" },
    { problemSlug: "techet-truba", problem: "течёт труба" },
    { problemSlug: "zasor-kanalizacii", problem: "засор канализации" },
    { problemSlug: "zamena-smesitelya", problem: "замена смесителя" },
    { problemSlug: "ustanovka-unitaza", problem: "установка унитаза" },
    { problemSlug: "zamena-trub", problem: "замена труб" },
    { problemSlug: "podklyuchenie-stiralnoj", problem: "подключение стиральной машины" },
    { problemSlug: "podklyuchenie-posudomojki", problem: "подключение посудомойки" },
    { problemSlug: "ustanovka-bojlera", problem: "установка бойлера" },
    { problemSlug: "net-goryachej-vody", problem: "нет горячей воды" },
  ],
  elektrik: [
    { problemSlug: "vybivaet-avtomat", problem: "выбивает автомат" },
    { problemSlug: "net-sveta", problem: "нет света в квартире" },
    { problemSlug: "korotkoe-zamykanie", problem: "короткое замыкание" },
    { problemSlug: "zamena-rozetki", problem: "замена розетки" },
    { problemSlug: "zamena-provodki", problem: "замена проводки" },
    { problemSlug: "ustanovka-lyustry", problem: "установка люстры" },
    { problemSlug: "perenos-rozetok", problem: "перенос розеток" },
    { problemSlug: "ne-rabotaet-schetchik", problem: "не работает счётчик" },
    { problemSlug: "ustanovka-vyklyuchatelya", problem: "установка выключателя" },
  ],
  "remont-stiralnyh-mashin": [
    { problemSlug: "ne-vklyuchaetsya", problem: "не включается" },
    { problemSlug: "ne-slivaet", problem: "не сливает воду" },
    { problemSlug: "ne-otzhimaet", problem: "не отжимает" },
    { problemSlug: "techet-voda", problem: "течёт вода" },
    { problemSlug: "shumit-gremit", problem: "шумит и гремит" },
    { problemSlug: "ne-nabiraet-vodu", problem: "не набирает воду" },
    { problemSlug: "vydaet-oshibku", problem: "выдаёт ошибку на дисплее" },
    { problemSlug: "ne-greet-vodu", problem: "не греет воду" },
  ],
  "remont-holodilnikov": [
    { problemSlug: "ne-morozit", problem: "не морозит" },
    { problemSlug: "techet-voda-holodilnik", problem: "течёт вода" },
    { problemSlug: "ne-vklyuchaetsya-holodilnik", problem: "не включается" },
    { problemSlug: "shumit-holodilnik", problem: "шумит и вибрирует" },
    { problemSlug: "ne-rabotaet-morozilka", problem: "не работает морозилка" },
    { problemSlug: "inej-v-morozilke", problem: "иней в морозилке" },
    { problemSlug: "kompressor-ne-rabotaet", problem: "компрессор не работает" },
  ],
  "remont-pmm": [
    { problemSlug: "ne-moet", problem: "плохо моет посуду" },
    { problemSlug: "ne-sushit", problem: "не сушит" },
    { problemSlug: "ne-slivaet-posud", problem: "не сливает воду" },
    { problemSlug: "ne-zapuskaetsya", problem: "не запускается" },
    { problemSlug: "techet-posud", problem: "течёт снизу" },
    { problemSlug: "shumit-posud", problem: "сильно шумит" },
  ],
  "remont-kondicionerov": [
    { problemSlug: "ne-ohlazhdaet", problem: "не охлаждает" },
    { problemSlug: "techet-kondicioner", problem: "течёт вода" },
    { problemSlug: "ne-vklyuchaetsya-kond", problem: "не включается" },
    { problemSlug: "shumit-kond", problem: "шумит при работе" },
    { problemSlug: "ne-greet-kond", problem: "не греет в режиме тепла" },
    { problemSlug: "zapah-kond", problem: "неприятный запах" },
  ],
  kp: [
    { problemSlug: "ne-vklyuchaetsya-pk", problem: "не включается" },
    { problemSlug: "medlenno-rabotaet", problem: "медленно работает" },
    { problemSlug: "sinij-ekran", problem: "синий экран смерти" },
    { problemSlug: "virusy", problem: "вирусы и реклама" },
    { problemSlug: "ne-vidit-disk", problem: "не видит диск" },
    { problemSlug: "ne-podklyuchaetsya-wifi", problem: "не подключается к Wi-Fi" },
    { problemSlug: "ustanovka-windows", problem: "установка Windows" },
    { problemSlug: "vosstanovlenie-dannyh", problem: "восстановление данных" },
  ],
  "master-na-chas": [
    { problemSlug: "sbor-mebeli", problem: "сборка мебели" },
    { problemSlug: "povesit-polku", problem: "повесить полку" },
    { problemSlug: "povesit-kartinu", problem: "повесить картину" },
    { problemSlug: "ustanovka-dveri", problem: "установка двери" },
    { problemSlug: "remont-zamka", problem: "ремонт замка" },
    { problemSlug: "pokleit-oboi", problem: "поклеить обои" },
  ],
  "remont-televizorov": [
    { problemSlug: "ne-vklyuchaetsya", problem: "не включается" },
    { problemSlug: "net-izobrazheniya", problem: "нет изображения" },
    { problemSlug: "est-zvuk-net-izobrazheniya", problem: "есть звук, но нет изображения" },
    { problemSlug: "polosy-na-ekrane", problem: "полосы на экране" },
    { problemSlug: "ne-lovit-kanaly", problem: "не ловит каналы" },
    { problemSlug: "ne-podklyuchaetsya-k-wifi", problem: "не подключается к Wi-Fi" },
    { problemSlug: "ne-rabotaet-pult", problem: "не работает пульт" },
  ],
  "remont-okon": [
    { problemSlug: "duet-iz-okna", problem: "дует из окна" },
    { problemSlug: "ne-zakryvaetsya", problem: "не закрывается" },
    { problemSlug: "ne-otkryvaetsya", problem: "не открывается" },
    { problemSlug: "zapotevaet-okno", problem: "запотевает окно" },
    { problemSlug: "slomalas-ruchka", problem: "сломалась ручка" },
    { problemSlug: "produvaet", problem: "продувает" },
    { problemSlug: "zamena-uplotnitelya", problem: "замена уплотнителя" },
  ],
  "remont-vodonagrevatelej": [
    { problemSlug: "ne-greet-vodu", problem: "не греет воду" },
    { problemSlug: "bet-tokom", problem: "бьёт током" },
    { problemSlug: "techet", problem: "течёт" },
    { problemSlug: "vybivaet-uzo", problem: "выбивает УЗО" },
    { problemSlug: "malo-goryachej-vody", problem: "мало горячей воды" },
    { problemSlug: "shumit-gudit", problem: "шумит и гудит" },
  ],
  "remont-duhovyh-shkafov": [
    { problemSlug: "ne-greet", problem: "не греет" },
    { problemSlug: "ne-nabiraet-temperaturu", problem: "не набирает температуру" },
    { problemSlug: "ne-vklyuchaetsya", problem: "не включается" },
    { problemSlug: "ne-rabotaet-gril", problem: "не работает гриль" },
    { problemSlug: "dymit", problem: "дымит" },
    { problemSlug: "ne-zakryvaetsya-dvertsa", problem: "не закрывается дверца" },
  ],
  "remont-varochnyh-panelej": [
    { problemSlug: "ne-vklyuchaetsya-konforka", problem: "не включается конфорка" },
    { problemSlug: "ne-vidit-posudu", problem: "индукция не видит посуду" },
    { problemSlug: "treschina-na-stekle", problem: "трещина на стекле" },
    { problemSlug: "ne-reguliruetsya-moschnost", problem: "не регулируется мощность" },
    { problemSlug: "iskrit", problem: "искрит" },
    { problemSlug: "ne-rabotaet-sensor", problem: "не работает сенсорное управление" },
  ],
  "remont-kofemashin": [
    { problemSlug: "ne-varit-kofe", problem: "не варит кофе" },
    { problemSlug: "techet", problem: "течёт" },
    { problemSlug: "ne-nabiraet-vodu", problem: "не набирает воду" },
    { problemSlug: "slaboe-davlenie", problem: "слабое давление" },
    { problemSlug: "trebuet-chistki-ot-nakipi", problem: "требует чистки от накипи" },
    { problemSlug: "ne-vklyuchaetsya", problem: "не включается" },
  ],
  dezinfekciya: [
    { problemSlug: "tarakany-v-kvartire", problem: "тараканы в квартире" },
    { problemSlug: "klopy-v-krovati", problem: "клопы в кровати" },
    { problemSlug: "muravi-v-kvartire", problem: "муравьи в квартире" },
    { problemSlug: "myshi-i-krysy", problem: "мыши и крысы" },
    { problemSlug: "plesen-na-stenah", problem: "плесень на стенах" },
    { problemSlug: "zapah-v-kvartire", problem: "неприятный запах в квартире" },
  ],
  klining: [
    { problemSlug: "uborka-posle-remonta", problem: "уборка после ремонта" },
    { problemSlug: "generalnaya-uborka", problem: "генеральная уборка" },
    { problemSlug: "mytie-okon", problem: "мытьё окон" },
    { problemSlug: "himchistka-divana", problem: "химчистка дивана" },
    { problemSlug: "himchistka-kovra", problem: "химчистка ковра" },
    { problemSlug: "uborka-posle-pozhara", problem: "уборка после пожара" },
  ],
  "sborka-mebeli": [
    { problemSlug: "sborka-shkafa", problem: "сборка шкафа" },
    { problemSlug: "sborka-kuhni", problem: "сборка кухни" },
    { problemSlug: "sborka-krovati", problem: "сборка кровати" },
    { problemSlug: "razborka-mebeli", problem: "разборка мебели" },
    { problemSlug: "naveska-fasadov", problem: "навеска фасадов" },
    { problemSlug: "remont-mebeli", problem: "ремонт мебели" },
  ],
};

/** «Вызов {…} на дом» — форма для title по serviceSlug */
export const SERVICE_CALL_LABEL: Record<string, string> = {
  santehnik: "сантехника",
  elektrik: "электрика",
  "remont-stiralnyh-mashin": "мастера",
  "remont-holodilnikov": "мастера",
  "remont-pmm": "мастера",
  "remont-kondicionerov": "мастера",
  kp: "мастера",
  "master-na-chas": "мастера",
  "remont-televizorov": "мастера",
  "remont-okon": "мастера",
  "remont-vodonagrevatelej": "мастера",
  "remont-duhovyh-shkafov": "мастера",
  "remont-varochnyh-panelej": "мастера",
  "remont-kofemashin": "мастера",
  dezinfekciya: "специалиста",
  klining: "клинера",
  "sborka-mebeli": "мастера",
};

export interface ProblemPage {
  slug: string;
  service: string;
  serviceSlug: string;
  city: string;
  cityDat: string;
  problem: string;
  problemSlug: string;
  title: string;
  h1: string;
  description: string;
  phone: string;
}

const CSV_PATH = path.join(process.cwd(), "data", "problems-cluster.csv");

let cache: ProblemPage[] | null = null;
let cacheBySlug: Map<string, ProblemPage> | null = null;
// Индексы для перелинковки — строятся один раз, O(1) вместо O(29k) на запрос.
let byServiceCity: Map<string, ProblemPage[]> | null = null; // `${serviceSlug}|${city}`
let byProblemService: Map<string, ProblemPage[]> | null = null; // `${problemSlug}|${serviceSlug}`

function safeString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** parentSlug = slug без хвоста `-{problemSlug}` */
export function getParentSlug(page: Pick<ProblemPage, "slug" | "problemSlug">): string {
  const suffix = `-${page.problemSlug}`;
  return page.slug.endsWith(suffix) ? page.slug.slice(0, -suffix.length) : page.slug;
}

function normalize(raw: Record<string, unknown>): ProblemPage {
  const slug = safeString(raw.slug);
  const problemSlug = safeString(raw.problemSlug);
  const service = safeString(raw.service) || "Услуга";
  const parentSlug = slug.endsWith(`-${problemSlug}`)
    ? slug.slice(0, -(problemSlug.length + 1))
    : slug;
  const parent = getPageBySlug(parentSlug);

  return {
    slug,
    service,
    serviceSlug: parent ? getServiceSlug(parent) : "usluga",
    city: safeString(raw.city),
    cityDat: safeString(raw.cityDat) || safeString(raw.city),
    problem: safeString(raw.problem),
    problemSlug,
    title: safeString(raw.title),
    h1: safeString(raw.h1),
    description: safeString(raw.description),
    phone: parent ? parent.phone : FALLBACK_PHONE,
  };
}

function load(): ProblemPage[] {
  if (cache) return cache;

  if (!fs.existsSync(CSV_PATH)) {
    cache = [];
    cacheBySlug = new Map();
    return cache;
  }

  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  cache = rows.map(normalize).filter((p) => p.slug);
  cacheBySlug = new Map(cache.map((p) => [p.slug, p]));
  byServiceCity = new Map();
  byProblemService = new Map();
  for (const p of cache) {
    const k1 = `${p.serviceSlug}|${p.city}`;
    (byServiceCity.get(k1) ?? byServiceCity.set(k1, []).get(k1)!).push(p);
    const k2 = `${p.problemSlug}|${p.serviceSlug}`;
    (byProblemService.get(k2) ?? byProblemService.set(k2, []).get(k2)!).push(p);
  }
  return cache;
}

export function getAllProblemPages(): ProblemPage[] {
  return load();
}

export function getProblemPageBySlug(slug: string): ProblemPage | null {
  if (!cacheBySlug) load();
  return cacheBySlug?.get(slug) ?? null;
}

export function getProblemPagesByService(serviceSlug: string): ProblemPage[] {
  return load().filter((p) => p.serviceSlug === serviceSlug);
}

export function getProblemPagesByCity(city: string): ProblemPage[] {
  return load().filter((p) => p.city === city);
}

/**
 * Проблемные страницы конкретной услуги в конкретном городе.
 * Нужно для перелинковки гео-страницы `/[slug]` → дочерние `/problem-service/*`
 * (иначе кластер из 11 684 страниц — сирота без входящих ссылок).
 */
export function getProblemPagesForServiceCity(
  serviceSlug: string,
  city: string,
  limit = 8
): ProblemPage[] {
  load();
  return (byServiceCity?.get(`${serviceSlug}|${city}`) ?? []).slice(0, limit);
}

/** Другие проблемы той же услуги в том же городе */
export function getRelatedProblemsSameCity(page: ProblemPage, limit = 8): ProblemPage[] {
  load();
  return (byServiceCity?.get(`${page.serviceSlug}|${page.city}`) ?? [])
    .filter((p) => p.slug !== page.slug)
    .slice(0, limit);
}

/** Та же проблема в соседних городах */
export function getSameProblemOtherCities(page: ProblemPage, limit = 5): ProblemPage[] {
  load();
  return (byProblemService?.get(`${page.problemSlug}|${page.serviceSlug}`) ?? [])
    .filter((p) => p.city !== page.city)
    .slice(0, limit);
}

/* ─── Контент, специфичный для проблемы ───────────────────────────── */

export interface UrgencyReason {
  title: string;
  desc: string;
}

export function getUrgencyReasons(page: ProblemPage): UrgencyReason[] {
  const p = page.problem.toLowerCase();
  return [
    {
      title: "Проблема усугубляется",
      desc: `Чем дольше откладывать «${p}», тем выше риск серьёзной поломки и дорогого ремонта.`,
    },
    {
      title: "Лишние расходы",
      desc: `Своевременный вызов мастера в ${page.cityDat} обходится дешевле, чем устранение последствий.`,
    },
    {
      title: "Безопасность",
      desc: "Неисправность может привести к протечке, замыканию или повреждению имущества — не рискуйте.",
    },
  ];
}

export interface FixStep {
  step: string;
  title: string;
  desc: string;
}

export function getFixSteps(page: ProblemPage): FixStep[] {
  const p = page.problem.toLowerCase();
  return [
    {
      step: "1",
      title: "Диагностика",
      desc: `Мастер выезжает в ${page.cityDat} и бесплатно определяет причину: «${p}».`,
    },
    {
      step: "2",
      title: "Расчёт стоимости",
      desc: "Согласовываем цену и сроки до начала работ — без скрытых доплат.",
    },
    {
      step: "3",
      title: "Устранение",
      desc: "Выполняем работы на месте, используем проверенные детали и инструмент.",
    },
    {
      step: "4",
      title: "Проверка и гарантия",
      desc: "Проверяем результат при вас и выдаём гарантию до 12 месяцев.",
    },
  ];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function getProblemFaqs(page: ProblemPage): FaqItem[] {
  const service = page.service;
  const p = page.problem.toLowerCase();
  const city = page.cityDat;

  return [
    {
      question: `Сколько стоит устранить «${p}» в ${city}?`,
      answer: `Точная стоимость зависит от причины и определяется после диагностики. Выезд мастера и диагностика — бесплатно при выполнении работ. Звоните: ${page.phone}.`,
    },
    {
      question: `Как быстро приедет мастер в ${city}?`,
      answer: "Мастер выезжает в течение 30–60 минут после заявки, работаем круглосуточно без выходных.",
    },
    {
      question: `Можно ли устранить «${p}» за один визит?`,
      answer: `В большинстве случаев — да. ${service} в ${city} устраняет неисправность на месте, если не требуется заказ редких запчастей.`,
    },
    {
      question: "Даёте ли вы гарантию на работы?",
      answer: "Да, на все выполненные работы и установленные детали предоставляется гарантия до 12 месяцев.",
    },
    {
      question: "Нужно ли вносить предоплату?",
      answer: "Нет, оплата производится после выполнения работ. Диагностика бесплатна при ремонте.",
    },
  ];
}
