import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { slugify } from "../lib/transliterate";
import type { BlogArticle } from "../lib/blog-types";

interface CsvPage {
  slug: string;
  city: string;
  cityPrepositional: string;
  service: string;
  serviceSlug: string;
  phone: string;
}

const MAIN_SERVICES = new Set([
  "santehnik",
  "elektrik",
  "remont-stiralnyh-mashin",
  "remont-holodilnikov",
  "kp",
  "remont-televizorov",
  "master-na-chas",
]);

interface ProblemTemplate {
  slugPart: string;
  titlePart: string;
  problem: string;
  symptoms: string[];
  selfCheck: string[];
  whenCall: string[];
  priceHint: string;
}

interface ThemeTemplate {
  id: string;
  tag: string;
  title: (problem: ProblemTemplate, service: string, city: string) => string;
  slug: (problem: ProblemTemplate, citySlug: string) => string;
  description: (problem: ProblemTemplate, service: string, cityPrepositional: string) => string;
}

const PROBLEMS: Record<string, ProblemTemplate[]> = {
  santehnik: [
    {
      slugPart: "techet-kran",
      titlePart: "течёт кран",
      problem: "протечка из крана или смесителя",
      symptoms: ["капает из-под ручки", "вода не перекрывается полностью", "на сифоне скапливается вода"],
      selfCheck: ["проверьте, плотно ли закрыт вентиль", "осмотрите прокладку и износ картриджа", "убедитесь, что нет трещин на корпусе смесителя"],
      whenCall: ["протечка усиливается", "появился ржавый налёт или запах", "вода попадает на электроприборы"],
      priceHint: "от 600 ₽ за устранение протечки, замена смесителя — от 800 ₽",
    },
    {
      slugPart: "zasor-kanalizatsii",
      titlePart: "засор канализации",
      problem: "медленный слив или засор в канализации",
      symptoms: ["вода уходит медленно", "появляется неприятный запах", "булькает раковина или ванна"],
      selfCheck: ["не сливайте жир и остатки пищи в раковину", "проверьте сифон на видимый засор", "используйте только мягкие средства без агрессивной химии"],
      whenCall: ["засор повторяется", "вода поднимается в соседних точках", "самостоятельная прочистка не помогла"],
      priceHint: "прочистка канализации — от 1 500 ₽",
    },
    {
      slugPart: "net-goryachey-vody",
      titlePart: "нет горячей воды",
      problem: "отсутствие горячей воды в квартире",
      symptoms: ["из крана идёт только холодная вода", "тёплая вода появляется с задержкой", "перепады температуры при включении"],
      selfCheck: ["проверьте, есть ли ГВС в доме", "осмотрите смеситель на засор сетки", "убедитесь, что перекрыл кран на стояке открыт"],
      whenCall: ["проблема только у вас, а в доме вода есть", "течёт узел или шумит стояк", "нужна замена участка трубы"],
      priceHint: "диагностика бесплатно при выполнении работ",
    },
  ],
  elektrik: [
    {
      slugPart: "vybivaet-avtomat",
      titlePart: "выбивает автомат",
      problem: "срабатывание автоматического выключателя",
      symptoms: ["отключается свет в квартире", "автомат не держит нагрузку", "искрит розетка при включении прибора"],
      selfCheck: ["отключите новые приборы по одному", "проверьте, не перегружен ли щиток", "не включайте автомат многократно подряд"],
      whenCall: ["пахнет гарью", "видны следы оплавления", "проблема возвращается сразу после включения"],
      priceHint: "замена автомата — от 800 ₽, поиск неисправности — от 1 000 ₽",
    },
    {
      slugPart: "net-sveta",
      titlePart: "нет света",
      problem: "отсутствие освещения в части квартиры",
      symptoms: ["не горят лампы в одной комнате", "не работают розетки в зоне", "мигает свет при включении нагрузки"],
      selfCheck: ["проверьте автомат в щитке", "замените лампу или LED-лампочку", "убедитесь, что выключатель исправен"],
      whenCall: ["нет питания после проверки автомата", "слышен треск в щитке", "розетки нагреваются"],
      priceHint: "выезд и диагностика — бесплатно при ремонте",
    },
    {
      slugPart: "iskrit-rozetka",
      titlePart: "искрит розетка",
      problem: "искрение или нагрев розетки",
      symptoms: ["искры при включении вилки", "розетка тёплая на ощупь", "периодически пропадает питание"],
      selfCheck: ["не используйте повреждённую розетку", "проверьте вилку прибора", "снизьте нагрузку на линию"],
      whenCall: ["запах пластика или гари", "плавится лицевая панель", "искрение не прекращается"],
      priceHint: "замена розетки — от 500 ₽",
    },
  ],
  "remont-stiralnyh-mashin": [
    {
      slugPart: "ne-slivaet-vodu",
      titlePart: "не сливает воду",
      problem: "стиральная машина не сливает воду после стирки",
      symptoms: ["вода остаётся в барабане", "стирка останавливается на полоскании", "на дисплее ошибка слива"],
      selfCheck: ["проверьте фильтр насоса", "убедитесь, что шланг не пережат", "осмотрите сливной патрубок на засор"],
      whenCall: ["насос не гудит", "вода сливается только частично", "появилась протечка снизу"],
      priceHint: "ремонт насоса — от 1 500 ₽, замена — от 2 000 ₽",
    },
    {
      slugPart: "ne-krutit-baraban",
      titlePart: "не крутит барабан",
      problem: "барабан стиральной машины не вращается",
      symptoms: ["стирка идёт, но барабан стоит", "слышен гул, но нет вращения", "машина останавливается с ошибкой"],
      selfCheck: ["проверьте, не перегружена ли машина", "убедитесь, что ремень не соскочил визуально недоступен — не разбирайте", "отключите от сети при постороннем шуме"],
      whenCall: ["резкий запах гари", "течёт вода из-под корпуса", "ошибка повторяется на разных программах"],
      priceHint: "замена ремня — от 1 800 ₽, ремонт двигателя — от 2 500 ₽",
    },
    {
      slugPart: "shumit-pri-otzhime",
      titlePart: "шумит при отжиме",
      problem: "сильный шум и вибрация при отжиме",
      symptoms: ["машина прыгает", "громкий гул на высоких оборотах", "стук металлический"],
      selfCheck: ["проверьте транспортировочные болты — сняты ли", "убедитесь, что машина стоит ровно", "не перегружайте барабан"],
      whenCall: ["шум резко усилился", "появился запах подшипника", "машина смещается при работе"],
      priceHint: "замена подшипников — от 3 000 ₽",
    },
  ],
  "remont-holodilnikov": [
    {
      slugPart: "ne-morozit",
      titlePart: "не морозит",
      problem: "холодильник перестал морозить",
      symptoms: ["продукты портятся быстрее", "компрессор работает без остановки", "в морозилке таяние"],
      selfCheck: ["проверьте режим и терморегулятор", "убедитесь, что дверца закрывается плотно", "осмотрите уплотнитель на трещины"],
      whenCall: ["компрессор не включается", "слышен посторонний шум", "на стенках иней неравномерный"],
      priceHint: "заправка фреоном — от 2 500 ₽, замена термостата — от 1 500 ₽",
    },
    {
      slugPart: "shumit-kompressor",
      titlePart: "шумит компрессор",
      problem: "громкая работа компрессора холодильника",
      symptoms: ["гудение усилилось", "вибрация корпуса", "шум не прекращается"],
      selfCheck: ["проверьте, ровно ли стоит холодильник", "убедитесь в зазорах для вентиляции", "очистите решётку сзади от пыли"],
      whenCall: ["метallichesкий стук", "компрессор включается и сразу отключается", "холод пропал полностью"],
      priceHint: "диагностика бесплатно при ремонте",
    },
    {
      slugPart: "techet-voda",
      titlePart: "течёт вода",
      problem: "протечка воды из холодильника",
      symptoms: ["лужа под холодильником", "вода внутри камеры", "обледенение в неположенном месте"],
      selfCheck: ["проверьте дренажное отверстие", "убедитесь, что холодильник не перегружен", "осмотрите ёмкость для конденсата"],
      whenCall: ["вода не уходит после прочистки", "протечка усиливается", "пахнет проводкой"],
      priceHint: "устранение протечки — от 1 000 ₽",
    },
  ],
  kp: [
    {
      slugPart: "medlenno-rabotaet",
      titlePart: "медленно работает",
      problem: "компьютер или ноутбук работает медленно",
      symptoms: ["долго загружается Windows", "зависают программы", "высокая нагрузка без причин"],
      selfCheck: ["перезагрузите ПК", "проверьте автозагрузку", "освободите место на диске"],
      whenCall: ["синий экран", "перегрев и шум вентилятора", "данные не открываются"],
      priceHint: "чистка и оптимизация — от 800 ₽",
    },
    {
      slugPart: "ne-vklyuchaetsya",
      titlePart: "не включается",
      problem: "компьютер не включается",
      symptoms: ["нет реакции на кнопку", "вентилятор крутится, экран чёрный", "сразу выключается"],
      selfCheck: ["проверьте розетку и блок питания", "отключите новые USB-устройства", "попробуйте другую периферию"],
      whenCall: ["запах гари", "искрение", "после скачка напряжения"],
      priceHint: "диагностика — бесплатно при ремонте",
    },
    {
      slugPart: "net-interneta",
      titlePart: "нет интернета",
      problem: "пропал интернет на компьютере",
      symptoms: ["нет соединения по Wi-Fi", "браузер не открывает сайты", "иконка сети с ошибкой"],
      selfCheck: ["перезагрузите роутер", "проверьте кабель", "подключитесь к другой сети"],
      whenCall: ["проблема только на одном ПК после проверки роутера", "нужна настройка сети", "не работает сетевая карта"],
      priceHint: "настройка сети — от 800 ₽",
    },
  ],
  "remont-televizorov": [
    {
      slugPart: "net-izobrazheniya",
      titlePart: "нет изображения",
      problem: "телевизор включается, но нет картинки",
      symptoms: ["есть звук, нет изображения", "чёрный экран", "мигает подсветка"],
      selfCheck: ["проверьте источник сигнала", "переключите HDMI", "перезагрузите Smart TV"],
      whenCall: ["запах гари", "полосы на экране", "изображение пропадает периодически"],
      priceHint: "ремонт подсветки — от 2 500 ₽",
    },
    {
      slugPart: "net-zvuka",
      titlePart: "нет звука",
      problem: "нет звука на телевизоре",
      symptoms: ["картинка есть, звука нет", "хрипы или пропадания", "не реагирует на громкость"],
      selfCheck: ["проверьте mute", "переключите аудиовыход", "проверьте внешнюю акустику"],
      whenCall: ["звук пропал после грозы", "слышен треск", "не помогает сброс настроек"],
      priceHint: "ремонт аудиоканала — от 1 500 ₽",
    },
    {
      slugPart: "ne-vklyuchaetsya",
      titlePart: "не включается",
      problem: "телевизор не включается",
      symptoms: ["индикатор не горит", "мигает и гаснет", "зависает на логотипе"],
      selfCheck: ["проверьте розетку", "отключите на 5 минут от сети", "уберите перегрузку HDMI"],
      whenCall: ["запах", "искрит", "блок питания греется"],
      priceHint: "ремонт блока питания — от 2 000 ₽",
    },
  ],
  "master-na-chas": [
    {
      slugPart: "sborka-mebeli",
      titlePart: "сборка мебели",
      problem: "нужна сборка мебели на дому",
      symptoms: ["коробки занимают место", "нет времени на сборку", "сложная инструкция"],
      selfCheck: ["проверьте комплектацию", "подготовьте место", "сохраните фурнитуру"],
      whenCall: ["много модулей", "нужна навеска", "требуется сверление"],
      priceHint: "от 800 ₽ за модуль, мастер на час — от 1 500 ₽/час",
    },
    {
      slugPart: "melkiy-remont",
      titlePart: "мелкий ремонт",
      problem: "мелкий бытовой ремонт в квартире",
      symptoms: ["отошла плинтус", "шатается ручка", "нужно повесить зеркало"],
      selfCheck: ["составьте список задач", "подготовьте доступ к местам работ", "закажите мастера на 2–3 часа"],
      whenCall: ["работы смешанные: электрика и сантехника", "нужен инструмент", "важна аккуратность отделки"],
      priceHint: "от 500 ₽ за задачу",
    },
    {
      slugPart: "naves-polok",
      titlePart: "навес полок",
      problem: "навешивание полок и кронштейнов",
      symptoms: ["нужен перфоратор", "важно не попасть в проводку", "тяжёлые предметы"],
      selfCheck: ["разметьте места", "используйте уровень", "проверьте тип стены"],
      whenCall: ["крепление на плитку", "высокий потолок", "много точек крепления"],
      priceHint: "от 400 ₽ за полку",
    },
  ],
};

const THEMES: ThemeTemplate[] = [
  {
    id: "what-to-do",
    tag: "что делать",
    title: (p, service, city) => `Что делать, если ${p.titlePart} — ${city}`,
    slug: (p, citySlug) => `chto-delat-esli-${p.slugPart}-${citySlug}`,
    description: (p, service, cityPrep) =>
      `Пошаговые действия при ${p.problem}. Советы для жителей ${cityPrep} и когда вызывать мастера.`,
  },
  {
    id: "when-to-call",
    tag: "когда вызывать мастера",
    title: (p, service, city) => `Когда вызывать мастера: ${p.titlePart} в ${city}`,
    slug: (p, citySlug) => `kogda-vyzyvat-mastera-${p.slugPart}-${citySlug}`,
    description: (p, service, cityPrep) =>
      `Ситуации, когда нельзя откладывать ремонт ${service.toLowerCase()} в ${cityPrep}.`,
  },
  {
    id: "common-failures",
    tag: "частые неисправности",
    title: (p, service, city) => `Частые неисправности: ${p.titlePart} (${city})`,
    slug: (p, citySlug) => `${p.slugPart}-chastye-neispravnosti-${citySlug}`,
    description: (p, service, cityPrep) =>
      `Типовые причины ${p.problem} и способы диагностики в ${cityPrep}.`,
  },
  {
    id: "repair-cost",
    tag: "сколько стоит ремонт",
    title: (p, service, city) => `Сколько стоит ремонт: ${p.titlePart} в ${city}`,
    slug: (p, citySlug) => `skolko-stoit-remont-${p.slugPart}-${citySlug}`,
    description: (p, service, cityPrep) =>
      `Ориентировочные цены на ремонт ${service.toLowerCase()} в ${cityPrep}. ${p.priceHint}.`,
  },
  {
    id: "self-check",
    tag: "что проверить самостоятельно",
    title: (p, service, city) => `Что проверить самостоятельно: ${p.titlePart}`,
    slug: (p, citySlug) => `chto-proverit-${p.slugPart}-${citySlug}`,
    description: (p, service, cityPrep) =>
      `Безопасная самодиагностика перед вызовом мастера в ${cityPrep}.`,
  },
  {
    id: "avoid-damage",
    tag: "как не усугубить",
    title: (p, service, city) => `Как не усугубить поломку: ${p.titlePart}`,
    slug: (p, citySlug) => `kak-ne-usugubit-${p.slugPart}-${citySlug}`,
    description: (p, service, cityPrep) =>
      `Ошибки, которых стоит избегать при ${p.problem} в ${cityPrep}.`,
  },
];

function citySlugFromPageSlug(pageSlug: string): string {
  const parts = pageSlug.split("-");
  return parts[parts.length - 1] || slugify(pageSlug);
}

function buildContent(
  page: CsvPage,
  problem: ProblemTemplate,
  theme: ThemeTemplate
): string {
  const service = page.service;
  const city = page.city;
  const cityPrep = page.cityPrepositional || city;
  const paragraphs = [
    `${theme.description(problem, service, cityPrep)} ${problem.problem.charAt(0).toUpperCase() + problem.problem.slice(1)} — одна из частых причин обращений в сервис ПроМастер в ${cityPrep}. Ниже — понятный разбор симптомов, безопасных действий и ситуаций, когда нужен выезд мастера.`,
    `Типичные признаки: ${problem.symptoms.join("; ")}. Если вы замечаете один или несколько симптомов, не игнорируйте их — раннее обращение часто снижает стоимость ремонта и предотвращает повреждение соседних узлов.`,
    `Что можно проверить самостоятельно до приезда мастера: ${problem.selfCheck.join("; ")}. Эти шаги не заменяют профессиональную диагностику, но помогают понять масштаб проблемы и не усугубить ситуацию.`,
    `Когда вызывать мастера без отлагательств: ${problem.whenCall.join("; ")}. В таких случаях лучше отключить технику от сети или перекрыть воду и дождаться специалиста. Самостоятельная разборка без инструмента и опыта часто приводит к дополнительным расходам.`,
    `Ориентировочная стоимость работ в ${cityPrep}: ${problem.priceHint}. Точную цену мастер называет после осмотра — диагностика бесплатна при выполнении ремонта. Выезд по ${cityPrep} обычно занимает 30–60 минут.`,
    `Мастера ПроМастер работают ежедневно с 08:00 до 22:00. Мы ремонтируем ${service.toLowerCase()} на дому, используем проверенные запчасти и даём гарантию до 12 месяцев. Если вам нужен ${service.toLowerCase()} в ${cityPrep}, оставьте заявку на странице услуги или позвоните по телефону ${page.phone}.`,
    `Чтобы не усугубить поломку, не используйте агрессивные химические средства без инструкции, не оставляйте технику под нагрузкой при посторонних звуках и не игнорируйте повторяющиеся ошибки. Профилактический осмотр раз в сезон помогает избежать внезапных поломок.`,
    `Итог: при ${problem.problem} в ${cityPrep} начните с безопасной проверки, зафиксируйте симптомы и при сомнениях вызывайте мастера. Чем раньше начат грамотный ремонт, тем дешевле и быстрее восстановление работы оборудования.`,
  ];

  let content = paragraphs.join("\n\n");

  while (content.length < 2500) {
    content += `\n\nПроМастер обслуживает ${cityPrep} и ближайшие районы. Мы подбираем решение под ваш случай: ${problem.problem}. Звоните ${page.phone} — диспетчер уточнит детали и отправит мастера в удобное время.`;
  }

  if (content.length > 4000) {
    content = content.slice(0, 3990).trim() + "…";
  }

  return content;
}

function main() {
  const csvPath = path.join(process.cwd(), "data", "pages.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const pages = parse(raw, { columns: true, skip_empty_lines: true }) as CsvPage[];

  const articles: BlogArticle[] = [];
  const seenSlugs = new Set<string>();
  let idCounter = 1;

  for (const page of pages) {
    if (!MAIN_SERVICES.has(page.serviceSlug)) continue;

    const problems = PROBLEMS[page.serviceSlug];
    if (!problems?.length) continue;

    const citySlug = citySlugFromPageSlug(page.slug);
    const themeIndex = Math.abs(hashString(page.slug)) % THEMES.length;
    const problemIndex = Math.abs(hashString(page.slug + "-p")) % problems.length;
    const theme = THEMES[themeIndex];
    const problem = problems[problemIndex];

    let slug = theme.slug(problem, citySlug);
    if (seenSlugs.has(slug)) {
      slug = `${slug}-${theme.id}`;
    }
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const createdAt = new Date(Date.now() - idCounter * 86400000).toISOString().slice(0, 10);

    articles.push({
      id: String(idCounter++),
      slug,
      title: theme.title(problem, page.service, page.city),
      description: theme.description(problem, page.service, page.cityPrepositional || page.city),
      service: page.service,
      serviceSlug: page.serviceSlug,
      city: page.city,
      cityPrepositional: page.cityPrepositional || page.city,
      targetUrl: `/${page.slug}`,
      phone: page.phone,
      tags: [theme.tag, page.serviceSlug, page.city, problem.slugPart],
      content: buildContent(page, problem, theme),
      createdAt,
    });
  }

  // Гарантированные статьи для примеров из ТЗ
  const guaranteePages = pages.filter(
    (p) =>
      p.serviceSlug === "santehnik" &&
      p.city === "Калуга" &&
      p.slug === "santehnik-kaluga"
  );
  const kalugaWasher = pages.find(
    (p) => p.serviceSlug === "remont-stiralnyh-mashin" && p.city === "Калуга"
  );
  const samaraFridge = pages.find(
    (p) => p.serviceSlug === "remont-holodilnikov" && p.city === "Самара"
  );

  const guaranteed: { page: CsvPage; problem: ProblemTemplate; slug: string; title: string }[] = [];

  if (guaranteePages[0]) {
    const p = guaranteePages[0];
    const prob = PROBLEMS.santehnik[0];
    guaranteed.push({
      page: p,
      problem: prob,
      slug: "chto-delat-esli-techet-kran-kaluga",
      title: "Что делать, если течёт кран — Калуга",
    });
  }
  if (kalugaWasher) {
    const prob = PROBLEMS["remont-stiralnyh-mashin"][0];
    guaranteed.push({
      page: kalugaWasher,
      problem: prob,
      slug: "stiralnaya-mashina-ne-slivaet-vodu-kaluga",
      title: "Стиральная машина не сливает воду — Калуга",
    });
  }
  if (samaraFridge) {
    const prob = PROBLEMS["remont-holodilnikov"][0];
    guaranteed.push({
      page: samaraFridge,
      problem: prob,
      slug: "holodilnik-ne-morozit-samara",
      title: "Холодильник не морозит — Самара",
    });
  }

  for (const g of guaranteed) {
    const theme = THEMES[0];
    const existing = articles.findIndex((a) => a.slug === g.slug);
    const article: BlogArticle = {
      id: existing >= 0 ? articles[existing].id : String(idCounter++),
      slug: g.slug,
      title: g.title,
      description: theme.description(g.problem, g.page.service, g.page.cityPrepositional || g.page.city),
      service: g.page.service,
      serviceSlug: g.page.serviceSlug,
      city: g.page.city,
      cityPrepositional: g.page.cityPrepositional || g.page.city,
      targetUrl: `/${g.page.slug}`,
      phone: g.page.phone,
      tags: [theme.tag, g.page.serviceSlug, g.page.city, g.problem.slugPart],
      content: buildContent(g.page, g.problem, theme),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    if (existing >= 0) {
      articles[existing] = article;
    } else {
      seenSlugs.add(g.slug);
      articles.push(article);
    }
  }

  const outPath = path.join(process.cwd(), "data", "blog-articles.json");
  fs.writeFileSync(outPath, JSON.stringify(articles, null, 0), "utf-8");
  console.log(`Generated ${articles.length} blog articles → ${outPath}`);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

main();
