import { NextResponse } from "next/server";
import { appendVkTaskLogEntry } from "@/lib/vk-task-log";
import { contentPackInputFromTask, generateVkContentPack } from "@/lib/vk-content-pack-server";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "@/lib/vk-tasks";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";

    if (!taskId) {
      return NextResponse.json({ success: false, error: "taskId обязателен" }, { status: 400 });
    }

    const tasks = readVkTasksFile();
    const existing = tasks.find((task) => task.id === taskId);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Задача не найдена" }, { status: 404 });
    }

    const contentPack = generateVkContentPack(contentPackInputFromTask(existing));
    const updated = updateVkTask(tasks, taskId, { contentPack });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Задача не найдена" }, { status: 404 });
    }

    writeVkTasksFile(tasks);

    appendVkTaskLogEntry({
      taskId,
      action: "updated",
      oldStatus: existing.status,
      newStatus: updated.status,
      assignedAccount: updated.assignedAccount,
      vkUrl: updated.vkUrl,
      vkGroupId: updated.vkGroupId,
      message: "Контент-пакет перегенерирован",
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось перегенерировать контент";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
