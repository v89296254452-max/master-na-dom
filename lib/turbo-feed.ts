import { getAllPages } from "@/lib/pages";
import { getAiContent, getIndexableSlugSet } from "@/lib/ai-content";
import { phoneForService } from "@/lib/phones";
import { getSiteUrl } from "@/lib/site";

/**
 * Turbo RSS-фид для Яндекс.Турбо-страниц. Яндекс забирает фид, делает лёгкие
 * Turbo-версии страниц, индексит их быстро и приоритетит в мобильной выдаче —
 * обход медленной индексации молодого сайта.
 *
 * v1: индексируемые гео-страницы (услуга×город). Пагинация по 1000 в фиде.
 * Контент: h1 + ИИ-абзацы + кнопка звонка (конверсия).
 */
export const TURBO_CHUNK = 1000;

function cdataEscape(s: string): string {
  return s.replace(/]]>/g, "]]]]><![CDATA[>");
}
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface TurboItem {
  url: string;
  h1: string;
  paragraphs: string[];
  phoneHref: string;
  phoneDisplay: string;
}

/** Список индексируемых гео-страниц с ИИ-контентом (мемоизируется). */
let cache: TurboItem[] | null = null;
function buildItems(): TurboItem[] {
  if (cache) return cache;
  const siteUrl = getSiteUrl();
  const indexable = getIndexableSlugSet();
  const items: TurboItem[] = [];
  for (const p of getAllPages()) {
    if (!p.slug || !indexable.has(p.slug)) continue;
    const ai = getAiContent(p.slug);
    if (!ai || !ai.paragraphs?.length) continue;
    const phone = phoneForService(getServiceSlugSafe(p));
    items.push({
      url: `${siteUrl}/${p.slug}`,
      h1: `${p.service} в ${p.cityPrepositional || p.city}`,
      paragraphs: ai.paragraphs.slice(0, 6),
      phoneHref: phone.href,
      phoneDisplay: phone.display,
    });
  }
  cache = items;
  return items;
}

function getServiceSlugSafe(p: { serviceSlug?: string; slug: string }): string {
  if (p.serviceSlug) return p.serviceSlug;
  // slug = `${serviceSlug}-${citySlug}` — берём префикс до последнего сегмента города
  return p.slug.split("-").slice(0, -1).join("-") || p.slug;
}

export function turboChunkCount(): number {
  return Math.max(1, Math.ceil(buildItems().length / TURBO_CHUNK));
}

/** RSS Turbo-фида для чанка id (0-based). */
export function renderTurboFeed(id: number): string {
  const siteUrl = getSiteUrl();
  const all = buildItems();
  const slice = all.slice(id * TURBO_CHUNK, (id + 1) * TURBO_CHUNK);

  const items = slice
    .map((it) => {
      const body =
        `<header><h1>${xmlEscape(it.h1)}</h1></header>` +
        it.paragraphs.map((t) => `<p>${cdataEscape(t)}</p>`).join("") +
        `<p><a class="button" href="${it.phoneHref}">Вызвать мастера — ${xmlEscape(it.phoneDisplay)}</a></p>`;
      return (
        `<item turbo="true">` +
        `<link>${xmlEscape(it.url)}</link>` +
        `<turbo:content><![CDATA[${body}]]></turbo:content>` +
        `</item>`
      );
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss xmlns:yandex="http://news.yandex.ru" xmlns:media="http://search.yahoo.com/mrss/" xmlns:turbo="http://turbo.yandex.ru" version="2.0">\n` +
    `<channel>` +
    `<title>ПроМастер — вызов мастера на дом</title>` +
    `<link>${siteUrl}</link>` +
    `<description>Вызов проверенного мастера на дом: сантехник, электрик, ремонт техники.</description>` +
    `<language>ru</language>` +
    items +
    `</channel></rss>`
  );
}
