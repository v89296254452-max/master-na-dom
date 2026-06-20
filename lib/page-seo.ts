import type { Page } from "./pages";
import { getDistrictsList, getPhone, getServiceSlug } from "./pages";
import { getSeoBlocks, type SeoBlock } from "./seo-content";

export interface PageSeoSections {
  uniqueText: { title: string; paragraphs: string[] };
  typicalProblems: SeoBlock;
  beforeCallChecklist: SeoBlock;
  popularRequests: SeoBlock;
  supplementaryBlocks: SeoBlock[];
}

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function trimToLength(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  const slice = text.slice(0, maxLen);
  const lastSentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );

  if (lastSentence > maxLen * 0.7) {
    return `${slice.slice(0, lastSentence + 1).trim()}…`;
  }

  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLen).trim()}…`;
}

type ExtraBuilder = (ctx: {
  service: string;
  serviceLower: string;
  city: string;
  cityPrep: string;
  districts: string;
  phone: string;
}) => string;

const UNIQUE_EXTRA_PARAGRAPHS: ExtraBuilder[] = [
  (c) =>
    `Служба «Сервислид» работает в ${c.cityPrep} и принимает заявки ежедневно. Мастер по ${c.serviceLower} выезжает в течение 30–60 минут — в центр, спальные районы и пригород. Диагностика бесплатна при выполнении работ, стоимость согласовывается до начала ремонта.`,
  (c) =>
    `Жители ${c.city} часто заказывают ${c.serviceLower} при первых признаках неисправности: это помогает избежать дорогостоящего ремонта и простоя техники. Наши специалисты приезжают с инструментом и типовыми запчастями, большинство проблем устраняют за один визит.`,
  (c) =>
    `Обслуживаем все районы ${c.city}: ${c.districts || "весь город"}. Мастер заранее согласует время приезда и перезванивает за 15–20 минут до выезда. После ремонта вы получаете гарантию на работы — от 6 до 12 месяцев в зависимости от вида услуги.`,
  (c) =>
    `В ${c.cityPrep} мы выезжаем в квартиры, частные дома, офисы и коммерческие помещения. ${c.service} на дому удобнее, чем самостоятельный поиск мастера: диспетчер подберёт ближайшего специалиста, а вы экономите время на поездку в сервисный центр.`,
  (c) =>
    `Типовой выезд ${c.serviceLower} в ${c.cityPrep} занимает 1–2 часа. Мастер проводит диагностику, называет точную цену и приступает к работе только после вашего согласия. Оплата — наличными или переводом после выполнения.`,
  (c) =>
    `Если ситуация срочная — протечка, отключение электричества, поломка холодильника — сообщите об этом при звонке. Мы отправим ближайшего мастера в приоритетном порядке. Телефон службы в ${c.cityPrep}: ${c.phone}.`,
  (c) =>
    `Наши мастера знают особенности жилого фонда ${c.city}: старые дома с изношенными коммуникациями, новостройки с современной разводкой, частный сектор. Это ускоряет диагностику и помогает сразу предложить правильное решение.`,
  (c) =>
    `Заказать ${c.serviceLower} в ${c.cityPrep} можно по телефону ${c.phone} или через форму на сайте. Укажите адрес, опишите проблему — диспетчер перезвонит в течение 5 минут и уточнит детали заявки.`,
  (c) =>
    `Мы не навязываем лишние услуги: мастер объясняет причину поломки простым языком и предлагает несколько вариантов ремонта, если это возможно. Прозрачные цены и гарантия — основа нашей работы в ${c.cityPrep}.`,
  (c) =>
    `Сезонные нагрузки в ${c.city} влияют на частоту обращений: летом растёт спрос на ремонт кондиционеров и холодильников, зимой — на отопление и электрику. Мы держим резерв мастеров, чтобы выезжать без длительного ожидания.`,
  (c) =>
    `При повторном обращении в ${c.cityPrep} мы учитываем историю заявки и можем направить того же специалиста, если он доступен. Это удобно при гарантийном случае или доработке после предыдущего визита.`,
  (c) =>
    `${c.service} в ${c.cityPrep} — одна из самых востребованных бытовых услуг. Мы собрали типовые неисправности и чек-лист подготовки к визиту мастера на этой странице, чтобы вы быстрее решили проблему и сэкономили время.`,
  (c) =>
    `Если вы снимаете жильё в ${c.cityPrep}, мастер может связаться с владельцем для согласования работ — сообщите об этом диспетчеру. Выезд возможен в вечернее время и в выходные по предварительной договорённости.`,
  (c) =>
    `После завершения работ мастер убирает рабочую зону и проверяет результат вместе с вами. На все виды ${c.serviceLower} в ${c.cityPrep} действует гарантия — сохраните контакт ${c.phone} для быстрой связи при необходимости.`,
  (c) =>
    `Сравнивая предложения в ${c.city}, обращайте внимание не только на цену, но и на гарантию, скорость выезда и отзывы. Мы работаем официально, выдаём документы по запросу и фиксируем согласованную стоимость до начала ремонта.`,
];

function buildUniqueParagraphs(page: Page, blocks: SeoBlock[]): string[] {
  const service = page.service || "Услуга";
  const city = page.city || "";
  const cityPrep = page.cityPrepositional || city;
  const districts = getDistrictsList(page.districts).join(", ");
  const phone = getPhone(page.phone);
  const seed = hashSlug(page.slug || `${service}-${city}`);

  const ctx = {
    service,
    serviceLower: service.toLowerCase(),
    city,
    cityPrep,
    districts,
    phone,
  };

  const paragraphs: string[] = [...(blocks[0]?.paragraphs ?? [])];

  for (let i = 0; i < UNIQUE_EXTRA_PARAGRAPHS.length; i++) {
    const builder = UNIQUE_EXTRA_PARAGRAPHS[(seed + i) % UNIQUE_EXTRA_PARAGRAPHS.length];
    paragraphs.push(builder(ctx));
    if (paragraphs.join("\n\n").length >= 2000) break;
  }

  for (const block of [blocks[4], blocks[5]]) {
    if (!block?.paragraphs?.length) continue;
    for (const paragraph of block.paragraphs) {
      if (paragraphs.join("\n\n").length >= 2000) break;
      paragraphs.push(paragraph);
    }
  }

  let text = paragraphs.join("\n\n");

  if (text.length < 2000) {
    for (let i = 0; i < UNIQUE_EXTRA_PARAGRAPHS.length && text.length < 2000; i++) {
      const builder = UNIQUE_EXTRA_PARAGRAPHS[(seed + paragraphs.length + i) % UNIQUE_EXTRA_PARAGRAPHS.length];
      const extra = builder(ctx);
      if (!text.includes(extra)) {
        paragraphs.push(extra);
        text = paragraphs.join("\n\n");
      }
    }
  }

  if (text.length > 3000) {
    text = trimToLength(text, 3000);
    return text.split("\n\n").filter(Boolean);
  }

  return paragraphs.filter(Boolean);
}

function withTitle(block: SeoBlock | undefined, title: string): SeoBlock {
  return {
    title,
    paragraphs: block?.paragraphs ?? [],
    listItems: block?.listItems,
  };
}

export function getPageSeoSections(page: Page): PageSeoSections {
  const blocks = getSeoBlocks(page);
  const cityPrep = page.cityPrepositional || page.city || "городе";
  const city = page.city || "";

  return {
    uniqueText: {
      title: blocks[0]?.title ?? `${page.service || "Услуга"} в ${cityPrep}`,
      paragraphs: buildUniqueParagraphs(page, blocks),
    },
    typicalProblems: withTitle(blocks[1], "Типовые проблемы"),
    beforeCallChecklist: withTitle(blocks[3], "Что проверить до вызова мастера"),
    popularRequests: withTitle(blocks[2], `Популярные заявки в ${city || cityPrep}`),
    supplementaryBlocks: blocks.slice(4).filter((b) => b?.title),
  };
}

export function getUniqueSeoTextLength(page: Page): number {
  const { uniqueText } = getPageSeoSections(page);
  return uniqueText.paragraphs.join(" ").length;
}
