import { NextResponse } from "next/server";
import { getArticleById, isDzenArticleStatus, updateArticle } from "@/lib/dzen-storage";
import type { DzenArticleUpdate } from "@/lib/dzen-types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parsePublishedUrl(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return undefined;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const normalizedId = id.trim();

    if (!normalizedId) {
      return NextResponse.json({ success: false, error: "id обязателен" }, { status: 400 });
    }

    if (!getArticleById(normalizedId)) {
      return NextResponse.json({ success: false, error: "Статья не найдена" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const patch: DzenArticleUpdate = {};

    if ("status" in body) {
      if (!isDzenArticleStatus(body.status)) {
        return NextResponse.json(
          { success: false, error: `Некорректный status: ${String(body.status)}` },
          { status: 400 }
        );
      }
      patch.status = body.status;
    }

    if ("publishedUrl" in body) {
      const publishedUrl = parsePublishedUrl(body.publishedUrl);
      if (publishedUrl === undefined) {
        return NextResponse.json(
          { success: false, error: "publishedUrl должен быть строкой или null" },
          { status: 400 }
        );
      }
      patch.publishedUrl = publishedUrl;
    }

    if (patch.status === undefined && !("publishedUrl" in body)) {
      return NextResponse.json(
        { success: false, error: "Нужно передать status и/или publishedUrl" },
        { status: 400 }
      );
    }

    const updated = updateArticle(normalizedId, patch);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Статья не найдена" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      item: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить статью";
    const status = message.startsWith("Некорректный status:") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
