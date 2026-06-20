import { NextResponse } from "next/server";
import type { VkTaskLogAction } from "@/lib/vk-task-log-types";
import { VK_TASK_LOG_ACTIONS } from "@/lib/vk-task-log-types";
import { ensureVkTaskLogFile, filterVkTaskLog } from "@/lib/vk-task-log";

function isLogAction(value: string): value is VkTaskLogAction {
  return VK_TASK_LOG_ACTIONS.includes(value as VkTaskLogAction);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId")?.trim() || undefined;
    const accountId = searchParams.get("accountId")?.trim() || undefined;
    const actionParam = searchParams.get("action")?.trim() || undefined;
    const date = searchParams.get("date")?.trim() || undefined;

    if (actionParam && !isLogAction(actionParam)) {
      return NextResponse.json({ success: false, error: "Некорректный action" }, { status: 400 });
    }

    const entries = ensureVkTaskLogFile();
    const filtered = filterVkTaskLog(entries, {
      taskId,
      accountId,
      action: actionParam && isLogAction(actionParam) ? actionParam : undefined,
      date,
    });

    return NextResponse.json({ success: true, entries: filtered, total: filtered.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить журнал";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
