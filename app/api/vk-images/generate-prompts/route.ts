import { NextResponse } from "next/server";
import { generateAndSaveImagePrompts } from "@/lib/vk-image-assets-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";

    if (!taskId) {
      return NextResponse.json({ success: false, error: "taskId обязателен" }, { status: 400 });
    }

    const task = generateAndSaveImagePrompts(taskId);
    return NextResponse.json({ success: true, task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сгенерировать промпты";
    const status = message === "Задача не найдена" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
