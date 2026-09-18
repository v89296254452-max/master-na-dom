import { getSiteUrl } from "@/lib/site";

export const revalidate = 86400;

/** /robots.txt — route-handler (метадата-конвенция robots.ts внутри route-group
 *  (site) не отдавалась → 404). Закрываем /admin и /api, указываем sitemap-индекс. */
export function GET() {
  const siteUrl = getSiteUrl();
  const host = siteUrl.replace(/^https?:\/\//, "");
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api",
    "",
    `Host: ${host}`,
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
