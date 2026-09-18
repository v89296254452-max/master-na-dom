import { BLOG_AUTHOR } from "@/lib/company";
import { getAllPosts, type BlogPost } from "@/lib/blog-posts";
import { getSiteUrl } from "@/lib/site";

/** RSS 2.0 для Яндекс.Вебмастера: Представление в поиске → Свежее и актуальное.
 *  Требования: https://yandex.ru/support/webmaster/ru/search-appearance/fresh-content
 *  Лимит файла — 10 МБ; в фид идут статьи блога (информационные, не реклама). */
const MAX_ITEMS = 100;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(isoDate: string): string {
  const d = new Date(`${isoDate}T09:00:00+03:00`);
  if (Number.isNaN(d.getTime())) return new Date().toUTCString().replace("GMT", "+0000");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  // Яндекс ждёт RFC-822 с явным смещением, не GMT.
  return `${days[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`;
}

function inlineToHtml(text: string): string {
  const withLinks = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const abs = href.startsWith("/") ? `${getSiteUrl()}${href}` : href;
    return `<a href="${xmlEscape(abs)}">${xmlEscape(label)}</a>`;
  });
  return withLinks.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** Markdown блога → простой HTML для yandex:full-text. CTA и рекламные вставки выкидываем. */
export function markdownToFullText(md: string): string {
  const lines = md.replace(/\[\[CTA\]\]/gi, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      out.push(`<h3>${inlineToHtml(trimmed.slice(4))}</h3>`);
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      out.push(`<h2>${inlineToHtml(trimmed.slice(3))}</h2>`);
      i++;
      continue;
    }
    if (trimmed.startsWith("> ")) {
      out.push(`<p>${inlineToHtml(trimmed.slice(2))}</p>`);
      i++;
      continue;
    }
    if (/^[-*] /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push(`<li>${inlineToHtml(lines[i].trim().slice(2))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(`<li>${inlineToHtml(lines[i].trim().replace(/^\d+\. /, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    out.push(`<p>${inlineToHtml(trimmed)}</p>`);
    i++;
  }
  return out.join("");
}

function itemXml(post: BlogPost, siteUrl: string): string {
  const url = `${siteUrl}/blog/${post.slug}`;
  const title = (post.h1 || post.title).replace(/\s*\|\s*ПроМастер\s*$/i, "").trim();
  const fullText = markdownToFullText(post.content);
  return (
    `<item>` +
    `<title>${xmlEscape(title.slice(0, 200))}</title>` +
    `<link>${xmlEscape(url)}</link>` +
    `<description>${xmlEscape(post.description.slice(0, 500))}</description>` +
    `<author>${xmlEscape(BLOG_AUTHOR.name)}</author>` +
    `<category>${xmlEscape(post.categoryName)}</category>` +
    `<pubDate>${rfc822(post.datePublished)}</pubDate>` +
    `<yandex:genre>article</yandex:genre>` +
    `<yandex:full-text><![CDATA[${fullText}]]></yandex:full-text>` +
    `</item>`
  );
}

export function renderRssFeed(): string {
  const siteUrl = getSiteUrl();
  const posts = getAllPosts()
    .filter((p) => p.slug && p.content && p.datePublished)
    .slice(0, MAX_ITEMS);

  const items = posts.map((p) => itemXml(p, siteUrl)).join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss xmlns:yandex="http://news.yandex.ru" xmlns:media="http://search.yahoo.com/mrss/" version="2.0">\n` +
    `<channel>` +
    `<title>ПроМастер — статьи о ремонте и бытовых услугах</title>` +
    `<link>${xmlEscape(siteUrl)}</link>` +
    `<description>Советы мастеров: сантехника, электрика, ремонт бытовой техники, цены и инструкции.</description>` +
    `<language>ru</language>` +
    items +
    `</channel></rss>`
  );
}
