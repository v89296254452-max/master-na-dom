import type { ProblemArticle, ProblemFaq } from "./problem-types";
import type { ProblemTemplate } from "./problem-templates";
import { PROBLEM_TEMPLATES } from "./problem-templates";

export { MAIN_PROBLEM_SERVICES, PROBLEM_TEMPLATES } from "./problem-templates";
export type { ProblemTemplate } from "./problem-templates";

export interface CsvPageInput {
  slug: string;
  city: string;
  cityPrepositional: string;
  service: string;
  serviceSlug: string;
  phone: string;
}

function citySlugFromPageSlug(pageSlug: string): string {
  const parts = pageSlug.split("-");
  return parts[parts.length - 1] || pageSlug;
}

function buildFaqs(template: ProblemTemplate, page: CsvPageInput): ProblemFaq[] {
  const cityPrep = page.cityPrepositional || page.city;
  return [
    {
      q: `Сколько стоит устранить «${template.title}» в ${cityPrep}?`,
      a: `${template.priceHint}. Точную цену мастер называет после осмотра — диагностика бесплатна при выполнении работ.`,
    },
    {
      q: `Как быстро приедет мастер в ${cityPrep}?`,
      a: `Выезд по ${cityPrep} обычно занимает 30–60 минут. Звонки принимаем круглосуточно — 24/7.`,
    },
    {
      q: `Можно ли устранить «${template.title}» самостоятельно?`,
      a: `До приезда мастера: ${template.selfCheck.slice(0, 2).join("; ")}. Если симптомы сохраняются — вызывайте специалиста.`,
    },
  ];
}

function buildContent(template: ProblemTemplate, page: CsvPageInput): string {
  const cityPrep = page.cityPrepositional || page.city;
  return [
    `${template.problem.charAt(0).toUpperCase() + template.problem.slice(1)} — частая причина обращений по услуге «${page.service}» в ${cityPrep}.`,
    `Типичные признаки: ${template.symptoms.join("; ")}.`,
    `Почему это происходит: ${template.whyHappens}`,
    `Что проверить самостоятельно: ${template.selfCheck.join("; ")}.`,
    `Когда вызывать мастера: ${template.whenCall.join("; ")}.`,
    `Ориентировочная стоимость в ${cityPrep}: ${template.priceHint}. Звоните ${page.phone} — заявки принимаем 24/7.`,
  ].join("\n\n");
}

export function buildProblemArticle(
  page: CsvPageInput,
  template: ProblemTemplate,
  id: string,
  relatedProblemSlugs: string[],
  relatedServices: { title: string; href: string }[],
  createdAt: string
): ProblemArticle {
  const slug = `${template.slugPart}-${page.slug}`;
  const cityPrep = page.cityPrepositional || page.city;

  return {
    id,
    slug,
    title: `${template.title} — ${page.city}`,
    description: `${template.title} в ${cityPrep}: причины, самопроверка и когда вызывать мастера. ${template.priceHint}.`,
    service: page.service,
    serviceSlug: page.serviceSlug,
    city: page.city,
    cityPrepositional: cityPrep,
    targetUrl: `/${page.slug}`,
    phone: page.phone,
    content: buildContent(template, page),
    problemKey: template.key,
    problemTitle: template.title,
    whyHappens: template.whyHappens,
    selfCheck: template.selfCheck,
    whenCall: template.whenCall,
    priceHint: template.priceHint,
    faqs: buildFaqs(template, page),
    relatedProblems: relatedProblemSlugs,
    relatedServices,
    createdAt,
  };
}

export function getTemplatesForService(serviceSlug: string): ProblemTemplate[] {
  return PROBLEM_TEMPLATES[serviceSlug] ?? [];
}

export { citySlugFromPageSlug };
