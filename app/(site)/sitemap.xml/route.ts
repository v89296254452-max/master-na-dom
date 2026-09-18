import { renderSitemapIndex } from "@/lib/sitemap-data";

export const revalidate = 86400;

/** /sitemap.xml — индекс, ссылающийся на подкарты /sitemaps/N.xml. */
export function GET() {
  return new Response(renderSitemapIndex(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
