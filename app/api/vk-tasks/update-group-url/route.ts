import { NextResponse } from "next/server";
import { updateTaskGroupFromUrl } from "@/lib/vk-group-bind";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    const urlInput =
      typeof body.urlInput === "string"
        ? body.urlInput.trim()
        : typeof body.vkUrl === "string"
          ? body.vkUrl.trim()
          : "";
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : undefined;

    if (!taskId) {
      return NextResponse.json({ success: false, error: "taskId обязателен" }, { status: 400 });
    }
    if (!urlInput) {
      return NextResponse.json({ success: false, error: "Ссылка обязательна" }, { status: 400 });
    }

    const result = await updateTaskGroupFromUrl({
      taskId,
      urlInput,
      accountId,
      save: true,
    });

    return NextResponse.json({
      success: true,
      task: result.task,
      resolve: result.resolve,
      groupInfo: result.groupInfo,
      message: `vkGroupId: ${result.task.vkGroupId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить ссылку группы";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
