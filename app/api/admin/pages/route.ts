import { NextResponse } from "next/server";
import { searchPages, type PageType } from "@/lib/admin/pages-browser";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const type = q.get("type") as PageType | null;
    const result = await searchPages({
      type: type || undefined,
      q: q.get("q") || undefined,
      indexed: (q.get("indexed") as "yes" | "no") || undefined,
      limit: q.get("limit") ? parseInt(q.get("limit")!, 10) : undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
