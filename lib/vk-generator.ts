import { getPhone, type Page } from "./pages";
import { getSiteUrl } from "./site";
import type { VkAccountGroup, VkPlanRow } from "./vk-types";

export type { VkAccountGroup, VkPlanRow } from "./vk-types";

const KP_SLUGS = new Set(["kp", "remont-televizorov"]);

const BT_SLUGS = new Set([
  "remont-kondicionerov",
  "remont-holodilnikov",
  "remont-kofemashin",
  "remont-vodonagrevatelej",
  "remont-pmm",
  "remont-varochnyh-panelej",
  "remont-stiralnyh-mashin",
  "remont-duhovyh-shkafov",
  "remont-parovyh-shkafov",
  "remont-vinnyh-shkafov",
  "remont-gladilnyh-sistem",
  "remont-massazhnyh-kresel",
]);

const MNCH_SLUGS = new Set([
  "santehnik",
  "elektrik",
  "remont-okon",
  "master-na-chas",
  "domashniy-remont",
]);

export function getPageSiteUrl(page: Pick<Page, "slug">): string {
  return `${getSiteUrl()}/${page.slug}`;
}

export function getAccountGroup(page: Pick<Page, "serviceSlug">): VkAccountGroup {
  const slug = page.serviceSlug.trim();

  if (KP_SLUGS.has(slug)) return "kp";
  if (BT_SLUGS.has(slug)) return "bt";
  if (MNCH_SLUGS.has(slug)) return "mnch";

  if (slug.startsWith("remont-")) return "bt";
  return "mnch";
}

export function getVkCommunityName(page: Pick<Page, "service" | "city">): string {
  return `${page.service} ${page.city}`;
}

export function getVkCommunityDescription(
  page: Pick<Page, "city" | "service" | "phone" | "slug">
): string {
  const phone = getPhone(page.phone);
  const siteUrl = getPageSiteUrl(page);

  return [
    `Вызов мастера в городе ${page.city}.`,
    `Услуга: ${page.service}.`,
    `Телефон: ${phone}`,
    `Сайт: ${siteUrl}`,
  ].join("\n");
}

export function getVkCommunityStatus(
  page: Pick<Page, "service" | "cityPrepositional" | "city" | "phone">
): string {
  const cityPrep = page.cityPrepositional || page.city;
  const phone = getPhone(page.phone);
  return `${page.service} в ${cityPrep}. Выезд мастера на дом. Звоните: ${phone}`;
}

export function getVkSeoKeywords(page: Pick<Page, "service" | "city" | "serviceSlug">): string {
  const serviceLower = page.service.toLowerCase();
  const city = page.city;

  const keywords = [
    `${page.service} ${city}`,
    `${serviceLower} ${city}`,
    `вызов мастера ${city}`,
    `${serviceLower} на дом ${city}`,
    `${page.service} на дому ${city}`,
    `мастер ${serviceLower} ${city}`,
    `${city} ${serviceLower}`,
  ];

  if (page.serviceSlug === "kp") {
    keywords.push(`компьютерная помощь ${city}`, `ремонт компьютера ${city}`);
  }

  return [...new Set(keywords)].join(", ");
}

function getPriceLines(page: Page): string[] {
  return [page.price1, page.price2, page.price3, page.price4].filter(Boolean);
}

export function getVkFirstPost(page: Page): string {
  const cityPrep = page.cityPrepositional || page.city;
  const phone = getPhone(page.phone);
  const siteUrl = getPageSiteUrl(page);
  const serviceLower = page.service.toLowerCase();
  const prices = getPriceLines(page);

  const priceBlock =
    prices.length > 0
      ? prices.map((p) => `• ${p}`).join("\n")
      : "• Диагностика бесплатно при заказе ремонта\n• Честные цены без скрытых доплат";

  const intro = `Ищете ${serviceLower} в ${cityPrep}? Выезжаем на дом в течение 30–60 минут по всему городу!`;

  const body = page.description
    ? page.description.replace(/\s+/g, " ").trim()
    : `Профессиональный ${serviceLower} с выездом на дом. Работаем во всех районах ${page.city}, даём гарантию на выполненные работы.`;

  const cta = `Звоните прямо сейчас: ${phone}\nПодробнее об услугах и ценах: ${siteUrl}`;

  const closing = `${page.service} в ${page.city} — опытные мастера, гарантия на работы, удобное время выезда. Оставьте заявку на сайте или позвоните нам!`;

  let post = [intro, "", priceBlock, "", body, "", cta, "", closing].join("\n");

  if (post.length < 500) {
    const extra =
      " Мы работаем ежедневно, принимаем заявки по телефону и через сайт. Мастер приедет с инструментом и расходными материалами, чтобы решить задачу за один визит.";
    post = post.replace(closing, closing + extra);
  }

  if (post.length > 700) {
    const maxBody = 700 - (post.length - body.length) - 3;
    const trimmedBody = body.slice(0, Math.max(120, maxBody)).replace(/\s+\S*$/, "") + "…";
    post = [intro, "", priceBlock, "", trimmedBody, "", cta, "", closing].join("\n");
  }

  while (post.length < 500 && post.length < 700) {
    post += " Работаем официально, без посредников.";
    if (post.length > 700) break;
  }

  if (post.length > 700) {
    post = post.slice(0, 697).replace(/\s+\S*$/, "") + "…";
  }

  return post;
}

export function buildVkPlanRow(page: Page, status = "pending"): VkPlanRow {
  return {
    city: page.city,
    service: page.service,
    slug: page.slug,
    phone: getPhone(page.phone),
    siteUrl: getPageSiteUrl(page),
    vkName: getVkCommunityName(page),
    vkDescription: getVkCommunityDescription(page),
    vkStatus: getVkCommunityStatus(page),
    vkFirstPost: getVkFirstPost(page),
    vkKeywords: getVkSeoKeywords(page),
    accountGroup: getAccountGroup(page),
    status,
  };
}
