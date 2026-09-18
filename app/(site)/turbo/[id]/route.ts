import { renderTurboFeed, turboChunkCount } from "@/lib/turbo-feed";

export const revalidate = 86400;

/** /turbo/N — Turbo RSS-фид, чанк N (по 1000 гео-страниц). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10); // "0" | "0.rss" → 0
  if (!Number.isInteger(n) || n < 0 || n >= turboChunkCount()) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(renderTurboFeed(n), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
