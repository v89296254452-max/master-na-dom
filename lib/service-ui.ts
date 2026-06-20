import type { Page } from "./pages";
import { getSeoBlocks } from "./seo-content";

export interface ServiceCard {
  title: string;
  icon: "wrench" | "bolt" | "drop" | "tool" | "home" | "clock";
}

export const BENEFITS = [
  { title: "Выезд за 30–60 мин", desc: "Мастер приедет в удобное время" },
  { title: "Гарантия на работы", desc: "От 6 до 12 месяцев" },
  { title: "Честные цены", desc: "Без скрытых доплат" },
];

export const HOW_WE_WORK = [
  { step: "1", title: "Заявка", desc: "Позвоните или оставьте заявку на сайте" },
  { step: "2", title: "Выезд мастера", desc: "Специалист приедет за 30–60 минут" },
  { step: "3", title: "Диагностика", desc: "Осмотр и согласование стоимости работ" },
  { step: "4", title: "Ремонт", desc: "Устранение проблемы с гарантией" },
];

const ICON_CYCLE: ServiceCard["icon"][] = [
  "wrench",
  "bolt",
  "drop",
  "tool",
  "home",
  "clock",
];

export function getHeroSubtitle(page: Page): string {
  const service = page.service || "Услуга";
  const cityPrep = page.cityPrepositional || page.city || "городе";
  return `${service} с выездом на дом в ${cityPrep}. Работаем ежедневно, принимаем срочные заявки.`;
}

export function getServiceCards(page: Page): ServiceCard[] {
  const blocks = getSeoBlocks(page);
  const problemsBlock = blocks[1];

  if (problemsBlock?.listItems?.length) {
    return problemsBlock.listItems.slice(0, 6).map((title, i) => ({
      title,
      icon: ICON_CYCLE[i % ICON_CYCLE.length],
    }));
  }

  return [];
}

export function parsePriceRow(price: string): { name: string; value: string } {
  if (!price?.trim()) {
    return { name: "", value: "" };
  }

  const separator = price.includes("—") ? "—" : "-";
  const parts = price.split(separator);

  if (parts.length >= 2) {
    return {
      name: parts[0].trim(),
      value: parts.slice(1).join(separator).trim(),
    };
  }

  return { name: price, value: "" };
}
