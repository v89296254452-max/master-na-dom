import { NextResponse } from "next/server";
import { bulkUpdateTaskGroupUrls } from "@/lib/vk-group-bind";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    const urls = Array.isArray(body.urls)
      ? body.urls.filter((item: unknown): item is string => typeof item === "string")
      : typeof body.text === "string"
        ? [body.text]
        : [];

    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId обязателен" }, { status: 400 });
    }

    const result = await bulkUpdateTaskGroupUrls({
      accountId,
      urls,
      save: true,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить массовое обновление";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
