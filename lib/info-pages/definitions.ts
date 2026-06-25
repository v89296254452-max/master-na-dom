import { getAllPages, getServiceSlug } from "../pages";
import { DISPLAY_BRANDS } from "../seo/brands";
import { FAILURES } from "../seo/failures";
import { slugify } from "../transliterate";

export interface InfoPage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  paragraphs: string[];
  type: "brand" | "model" | "error" | "problem";
  relatedServiceSlugs: string[];
}

const PROBLEM_MAP: Record<string, { title: string; serviceSlugs: string[] }> = {
  "ne-slivaet-vodu": {
    title: "Не сливает воду",
    serviceSlugs: ["remont-stiralnyh-mashin", "remont-pmm", "santehnik"],
  },
  "ne-vklyuchaetsya": {
    title: "Не включается",
    serviceSlugs: ["remont-stiralnyh-mashin", "remont-holodilnikov", "remont-televizorov", "kp"],
  },
  "ne-greet": {
    title: "Не греет",
    serviceSlugs: ["remont-stiralnyh-mashin", "remont-vodonagrevatelej", "remont-duhovyh-shkafov"],
  },
  "ne-morozit": {
    title: "Не морозит",
    serviceSlugs: ["remont-holodilnikov"],
  },
  shumit: {
    title: "Шумит",
    serviceSlugs: ["remont-holodilnikov", "remont-stiralnyh-mashin", "remont-kondicionerov"],
  },
  techet: {
    title: "Течёт",
    serviceSlugs: ["santehnik", "remont-stiralnyh-mashin", "remont-pmm"],
  },
};

function buildFullProblemMap(): Record<string, { title: string; serviceSlugs: string[] }> {
  const map = { ...PROBLEM_MAP };

  for (const [serviceSlug, items] of Object.entries(FAILURES)) {
    for (const item of items) {
      const slug = slugify(item);
      if (!map[slug]) {
        map[slug] = { title: item, serviceSlugs: [serviceSlug] };
      } else if (!map[slug].serviceSlugs.includes(serviceSlug)) {
        map[slug].serviceSlugs.push(serviceSlug);
      }
    }
  }

  return map;
}

const FULL_PROBLEM_MAP = buildFullProblemMap();

const ERROR_CODES: Record<string, { title: string; serviceSlugs: string[] }> = {
  f12: { title: "Код ошибки F12", serviceSlugs: ["remont-stiralnyh-mashin", "remont-holodilnikov"] },
  e03: { title: "Код ошибки E03", serviceSlugs: ["remont-stiralnyh-mashin", "remont-pmm"] },
  e01: { title: "Код ошибки E01", serviceSlugs: ["remont-stiralnyh-mashin"] },
  h1: { title: "Код ошибки H1", serviceSlugs: ["remont-kondicionerov"] },
};

const MODELS: Record<string, { title: string; brand: string; serviceSlugs: string[] }> = {
  "lg-f12": { title: "LG F12", brand: "LG", serviceSlugs: ["remont-stiralnyh-mashin"] },
  "samsung-wf": { title: "Samsung WF", brand: "Samsung", serviceSlugs: ["remont-stiralnyh-mashin"] },
  "bosch-serie4": { title: "Bosch Serie 4", brand: "Bosch", serviceSlugs: ["remont-stiralnyh-mashin", "remont-pmm"] },
};

function buildParagraphs(intro: string): string[] {
  return [
    intro,
    "Не пытайтесь разбирать технику без опыта — это может привести к удорожанию ремонта. Мастер проведёт диагностику на месте, назовёт точную стоимость и устранит неисправность с гарантией.",
    "ПроМастер принимает звонки круглосуточно — 24/7, без выходных. Выезд мастера — от 30 минут. Диагностика бесплатна при выполнении ремонта.",
  ];
}

export function getBrandPage(slug: string): InfoPage | undefined {
  const brand = DISPLAY_BRANDS.find((b) => b.slug === slug);
  if (!brand) return undefined;

  return {
    slug,
    type: "brand",
    title: `Ремонт техники ${brand.name} — ПроМастер`,
    description: `Ремонт ${brand.name} на дому. Диагностика бесплатно, гарантия до 12 месяцев. Выезд мастера от 30 минут.`,
    h1: `Ремонт ${brand.name}`,
    paragraphs: buildParagraphs(
      `Служба ПроМастер выполняет ремонт бытовой техники ${brand.name} на дому. Обслуживаем холодильники, стиральные машины, посудомойки, кондиционеры и другую технику этого бренда.`
    ),
    relatedServiceSlugs: [
      "remont-holodilnikov",
      "remont-stiralnyh-mashin",
      "remont-pmm",
      "remont-kondicionerov",
    ],
  };
}

export function getAllBrandPages(): InfoPage[] {
  return DISPLAY_BRANDS.map((b) => getBrandPage(b.slug)!);
}

export function getModelPage(slug: string): InfoPage | undefined {
  const model = MODELS[slug];
  if (!model) return undefined;

  return {
    slug,
    type: "model",
    title: `Ремонт ${model.title} — ПроМастер`,
    description: `Ремонт ${model.title} на дому. Оригинальные запчасти, гарантия, выезд от 30 минут.`,
    h1: `Ремонт ${model.title}`,
    paragraphs: buildParagraphs(
      `Мастера ПроМастер ремонтируют ${model.title} (${model.brand}). Знаем типовые неисправности этой модели и привозим нужные запчасти.`
    ),
    relatedServiceSlugs: model.serviceSlugs,
  };
}

export function getAllModelPages(): InfoPage[] {
  return Object.keys(MODELS).map((slug) => getModelPage(slug)!);
}

export function getErrorPage(code: string): InfoPage | undefined {
  const err = ERROR_CODES[code.toLowerCase()];
  if (!err) return undefined;

  return {
    slug: code.toLowerCase(),
    type: "error",
    title: `${err.title} — что означает и как исправить`,
    description: `Расшифровка ${err.title.toLowerCase()}. Когда можно устранить самостоятельно, а когда нужен мастер.`,
    h1: err.title,
    paragraphs: buildParagraphs(
      `${err.title} сигнализирует о неисправности в системе. Причины могут быть разными — от засора до выхода из строя модуля управления.`
    ),
    relatedServiceSlugs: err.serviceSlugs,
  };
}

export function getAllErrorPages(): InfoPage[] {
  return Object.keys(ERROR_CODES).map((code) => getErrorPage(code)!);
}

export function getProblemPage(slug: string): InfoPage | undefined {
  const problem = FULL_PROBLEM_MAP[slug];
  if (!problem) return undefined;

  return {
    slug,
    type: "problem",
    title: `${problem.title} — причины и ремонт`,
    description: `Почему ${problem.title.toLowerCase()}? Что делать до приезда мастера и сколько стоит ремонт.`,
    h1: problem.title,
    paragraphs: buildParagraphs(
      `Симптом «${problem.title.toLowerCase()}» встречается часто. Не откладывайте ремонт — своевременная диагностика помогает избежать дорогостоящей замены узлов.`
    ),
    relatedServiceSlugs: problem.serviceSlugs,
  };
}

export function getAllProblemPages(): InfoPage[] {
  return Object.keys(FULL_PROBLEM_MAP).map((slug) => getProblemPage(slug)!);
}

export function getCommercialLinksForInfoPage(info: InfoPage, limit = 12): { title: string; href: string }[] {
  const pages = getAllPages();
  const links: { title: string; href: string }[] = [];

  for (const svcSlug of info.relatedServiceSlugs) {
    const matches = pages.filter((p) => getServiceSlug(p) === svcSlug).slice(0, 3);
    for (const p of matches) {
      links.push({
        title: `${p.service} в ${p.cityPrepositional || p.city}`,
        href: `/${p.slug}`,
      });
    }
  }

  return links.slice(0, limit);
}
