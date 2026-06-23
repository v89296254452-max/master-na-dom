import { NextResponse } from "next/server";
import type { VkImageAssetType } from "@/lib/vk-image-assets-types";
import { saveExternalImageForTask } from "@/lib/vk-image-assets-server";

const VALID_TYPES: VkImageAssetType[] = ["avatar", "cover", "post"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    const type = body.type as VkImageAssetType;
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (!taskId) {
      return NextResponse.json({ success: false, error: "taskId обязателен" }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: "type должен быть avatar, cover или post" },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "imageUrl обязателен" }, { status: 400 });
    }

    const task = await saveExternalImageForTask({ taskId, type, imageUrl });
    return NextResponse.json({ success: true, task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить изображение";
    const status = message === "Задача не найдена" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
