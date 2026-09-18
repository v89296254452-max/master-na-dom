import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site";

/**
 * Триггер IndexNow прямо с сервера — не зависит от локальной машины (в
 * отличие от scripts/indexnow-submit.mjs). Ключ — INDEXNOW_KEY в .env.local.
 *
 * Без тела запроса (или с пустым `urls`) — читает собственный sitemap.xml и
 * шлёт ВСЕ URL (полный ресабмит, для ручного разового запуска из админки).
 * С телом `{"urls": ["https://.../slug1", ...]}` — шлёт только переданные
 * URL: используйте это после точечного обновления конкретных страниц, чтобы
 * не гонять весь sitemap на каждое мелкое изменение.
 */
async function collectSitemapUrls(siteUrl: string): Promise<string[]> {
  const seen = new Set<string>();
  async function pull(url: string) {
    const res = await fetch(url, { cache: "no-store" });
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (/<sitemapindex/i.test(xml)) {
      for (const sm of locs) await pull(sm);
    } else {
      for (const u of locs) seen.add(u);
    }
  }
  await pull(`${siteUrl}/sitemap.xml`);
  return [...seen];
}

export async function POST(request: Request) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return NextResponse.json({ success: false, error: "INDEXNOW_KEY не задан в .env.local" }, { status: 400 });
  }

  const siteUrl = getSiteUrl();
  const host = new URL(siteUrl).host;

  // Опциональный список конкретных URL в теле — точечная отправка вместо
  // полного ресабмита sitemap. Пустое/битое тело — не ошибка, просто fallback.
  let explicitUrls: string[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.urls)) {
      explicitUrls = body.urls.filter((u: unknown): u is string => typeof u === "string" && u.startsWith(siteUrl));
    }
  } catch {
    /* нет тела / не JSON — используем полный sitemap ниже */
  }

  try {
    const urls = explicitUrls.length ? explicitUrls : await collectSitemapUrls(siteUrl);
    const CHUNK = 10000;
    let submitted = 0;
    for (let i = 0; i < urls.length; i += CHUNK) {
      const urlList = urls.slice(i, i + CHUNK);
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key, keyLocation: `${siteUrl}/${key}.txt`, urlList }),
      });
      if (res.ok || res.status === 202) submitted += urlList.length;
    }
    return NextResponse.json({ success: true, total: urls.length, submitted, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
