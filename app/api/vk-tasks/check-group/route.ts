import { NextResponse } from "next/server";
import { checkTaskGroupBinding } from "@/lib/vk-group-bind";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : undefined;

    if (!taskId) {
      return NextResponse.json({ success: false, error: "taskId обязателен" }, { status: 400 });
    }

    const check = await checkTaskGroupBinding({ taskId, accountId });

    return NextResponse.json({
      success: !check.error,
      check,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось проверить группу";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
