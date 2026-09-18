import { renderUrlset, sitemapChunkCount } from "@/lib/sitemap-data";

export const revalidate = 86400;

/** /sitemaps/N.xml — подкарта N (≤45 000 URL). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10); // "0.xml" → 0
  if (!Number.isInteger(n) || n < 0 || n >= sitemapChunkCount()) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(renderUrlset(n), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
