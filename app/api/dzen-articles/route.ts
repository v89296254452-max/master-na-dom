import { NextResponse } from "next/server";
import { getAllArticles, getDzenArticlesPath, isDzenArticleStatus } from "@/lib/dzen-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim() ?? "";
    const service = searchParams.get("service")?.trim() ?? "";
    const city = searchParams.get("city")?.trim() ?? "";

    if (status && !isDzenArticleStatus(status)) {
      return NextResponse.json(
        { success: false, error: `Некорректный status: ${status}` },
        { status: 400 }
      );
    }

    let items = getAllArticles();

    if (status) {
      items = items.filter((article) => article.status === status);
    }

    if (service) {
      items = items.filter((article) => article.service === service);
    }

    if (city) {
      items = items.filter((article) => article.city === city);
    }

    return NextResponse.json({
      success: true,
      total: items.length,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить статьи";
    console.error("[dzen-articles] GET error:", message, "path:", getDzenArticlesPath());
    return NextResponse.json({ success: false, error: message, total: 0, items: [] }, { status: 500 });
  }
}
