import { NextResponse } from "next/server";
import { assignRandomImagesToTaskAndSave } from "@/lib/vk-image-assets-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";

    if (!taskId) {
      return NextResponse.json({ success: false, error: "taskId обязателен" }, { status: 400 });
    }

    const { task, warnings } = assignRandomImagesToTaskAndSave(taskId);
    return NextResponse.json({ success: true, task, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось назначить картинки";
    const status = message === "Задача не найдена" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
