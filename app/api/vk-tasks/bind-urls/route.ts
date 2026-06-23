import { NextResponse } from "next/server";
import { bindVkUrlsToAccountTasks, type VkUrlBindResult } from "@/lib/vk-url-bind";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    const urls = Array.isArray(body.urls)
      ? (body.urls as unknown[]).filter((item): item is string => typeof item === "string")
      : [];
    const useUnparsedQueue = body.useUnparsedQueue === true;
    const mode = body.mode === "auto" ? "auto" : "need_vk_url";

    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId обязателен" }, { status: 400 });
    }

    if (urls.length === 0 && !useUnparsedQueue) {
      return NextResponse.json(
        { success: false, error: "urls обязателен или useUnparsedQueue=true" },
        { status: 400 }
      );
    }

    const result: VkUrlBindResult = await bindVkUrlsToAccountTasks({
      accountId,
      urls,
      useUnparsedQueue,
      mode,
    });

    return NextResponse.json({
      success: true,
      result,
      message:
        result.tasksUpdated > 0
          ? `Привязано: ${result.tasksUpdated} из ${result.linksTotal} ссылок`
          : "Ни одна ссылка не привязана",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось привязать ссылки";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
