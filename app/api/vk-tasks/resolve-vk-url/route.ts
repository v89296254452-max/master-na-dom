import { NextResponse } from "next/server";
import { resolveAndUpdateVkTask } from "@/lib/vk-url-resolve";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    const vkUrl = typeof body.vkUrl === "string" ? body.vkUrl.trim() : "";
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : undefined;

    if (!taskId) {
      return NextResponse.json({ success: false, error: "taskId обязателен" }, { status: 400 });
    }
    if (!vkUrl) {
      return NextResponse.json({ success: false, error: "vkUrl обязателен" }, { status: 400 });
    }

    const { task, resolve } = await resolveAndUpdateVkTask({
      taskId,
      vkUrl,
      accountId,
      save: true,
    });

    if (!resolve.resolved) {
      return NextResponse.json(
        {
          success: false,
          error: resolve.error || "Не удалось распознать vkGroupId",
          resolve,
          task,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      task,
      resolve,
      message: `vkGroupId распознан: ${resolve.vkGroupId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось распознать VK URL";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
