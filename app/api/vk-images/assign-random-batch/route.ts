import { NextResponse } from "next/server";
import { assignRandomImagesBatch } from "@/lib/vk-image-assets-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const taskIds = Array.isArray(body.taskIds)
      ? body.taskIds.filter((item: unknown): item is string => typeof item === "string")
      : [];

    const result = assignRandomImagesBatch(taskIds.length > 0 ? taskIds : undefined);

    return NextResponse.json({
      success: true,
      tasks: result.tasks,
      warnings: result.warnings,
      processed: result.processed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось назначить картинки";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
