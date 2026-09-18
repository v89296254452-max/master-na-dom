import { renderRssFeed } from "@/lib/rss-feed";

export const revalidate = 3600;

/** /feed.xml — RSS 2.0 для Яндекс.Вебмастера (Свежее и актуальное). */
export function GET() {
  return new Response(renderRssFeed(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
    },
  });
}
