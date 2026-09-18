import { readFileSync } from "fs";
import path from "path";
import { getPageBySlug } from "@/lib/pages";

export const revalidate = 86400;

/** Уникальный URL логотипа на оффер: Яндекс требует разные ссылки picture,
 *  даже если файл один и тот же. */
const PNG = readFileSync(path.join(process.cwd(), "app", "icon.png"));

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const key = slug.replace(/\.png$/i, "");
  if (!getPageBySlug(key)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(PNG, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
