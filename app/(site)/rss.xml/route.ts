import { renderRssFeed } from "@/lib/rss-feed";

export const revalidate = 3600;

/** Алиас /rss.xml → тот же фид, что и /feed.xml. */
export function GET() {
  return new Response(renderRssFeed(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
    },
  });
}
