import { NextResponse } from "next/server";
import type { VkAccountGroup } from "@/lib/vk-types";
import type { VkTask, VkTaskStatus } from "@/lib/vk-task-types";
import { VK_TASK_STATUSES } from "@/lib/vk-task-types";
import {
  bulkUpdateVkTasks,
  ensureVkTasksFile,
  readVkTasksFile,
  takeVkTasks,
  updateVkTask,
  writeVkTasksFile,
  type VkTaskBulkUpdate,
} from "@/lib/vk-tasks";
import { getVkAccountById, getAvailableTakeCount, readVkAccountsFile } from "@/lib/vk-accounts";
import { isAccountEligibleForAssignment } from "@/lib/vk-account-auth";
import { appendVkTaskLogEntries, appendVkTaskLogEntry } from "@/lib/vk-task-log";
import {
  canSetPostedStatus,
  getPostedBlockedMessage,
  mergeQualityCheck,
  type VkTaskQualityCheck,
} from "@/lib/vk-quality-check";
import { mergeManualSetup, buildPreparedManualSetup, type VkTaskManualSetup } from "@/lib/vk-manual-setup";
import { resolveAndUpdateVkTask } from "@/lib/vk-url-resolve";
import { taskNeedsVkUrlResolve } from "@/lib/vk-url";
import { normalizeContentPack } from "@/lib/vk-content-pack";
import { statusAfterVkGroupLinked } from "@/lib/vk-task-status";

function isTaskStatus(value: unknown): value is VkTaskStatus {
  return typeof value === "string" && VK_TASK_STATUSES.includes(value as VkTaskStatus);
}

function isAccountGroup(value: unknown): value is VkAccountGroup {
  return value === "kp" || value === "bt" || value === "mnch";
}

export async function GET() {
  try {
    const tasks = ensureVkTasksFile();
    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить задачи";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json({ success: false, error: "id обязателен" }, { status: 400 });
    }

    const tasks = readVkTasksFile();
    const existing = tasks.find((task) => task.id === id);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Задача не найдена" }, { status: 404 });
    }

    const patch: Partial<
      Pick<
        VkTask,
        "vkUrl" | "vkGroupId" | "assignedAccount" | "status" | "qualityCheck" | "manualSetup" | "contentPack" | "manualCreated"
      >
    > = {};
    let nextQualityCheck = existing.qualityCheck;
    let nextManualSetup = existing.manualSetup;

    if (typeof body.vkUrl === "string") patch.vkUrl = body.vkUrl.trim();
    if (typeof body.vkGroupId === "string") patch.vkGroupId = body.vkGroupId.trim();
    if (typeof body.assignedAccount === "string") patch.assignedAccount = body.assignedAccount.trim();

    if (body.manualCreated === true || body.markManualCreated === true || body.action === "markManualCreated") {
      const vkGroupId = patch.vkGroupId ?? existing.vkGroupId.trim();

      if (!vkGroupId) {
        return NextResponse.json(
          { success: false, error: "vkGroupId обязателен для «Группа создана вручную»" },
          { status: 400 }
        );
      }

      patch.vkGroupId = vkGroupId;
      if (!patch.vkUrl && !existing.vkUrl.trim()) {
        patch.vkUrl = `https://vk.com/club${vkGroupId.replace(/^-/, "")}`;
      }
      patch.manualCreated = true;
      patch.status = statusAfterVkGroupLinked(
        {
          vkGroupId,
          assignedAccount: patch.assignedAccount ?? existing.assignedAccount,
        },
        readVkAccountsFile()
      );
    }

    if (body.qualityCheck && typeof body.qualityCheck === "object") {
      nextQualityCheck = mergeQualityCheck(
        existing.qualityCheck,
        body.qualityCheck as Partial<VkTaskQualityCheck>
      );
      patch.qualityCheck = nextQualityCheck;
    }

    if (body.manualSetup && typeof body.manualSetup === "object") {
      nextManualSetup = mergeManualSetup(
        existing.manualSetup,
        body.manualSetup as Partial<VkTaskManualSetup>
      );
      patch.manualSetup = nextManualSetup;
    }

    if (body.action === "markGroupPrepared" || body.markGroupPrepared === true) {
      patch.manualSetup = buildPreparedManualSetup();
      patch.status = "ready_for_worker";
    }

    if (body.regenerateContent === true) {
      return NextResponse.json(
        {
          success: false,
          error: "Используйте POST /api/vk-tasks/regenerate-content",
        },
        { status: 400 }
      );
    }

    if (body.regenerateVisuals === true) {
      return NextResponse.json(
        {
          success: false,
          error: "Используйте POST /api/vk-tasks/regenerate-visuals",
        },
        { status: 400 }
      );
    }

    if (body.contentPack && typeof body.contentPack === "object") {
      patch.contentPack = normalizeContentPack(body.contentPack);
    }

    if (isTaskStatus(body.status)) {
      if (body.status === "posted" && !canSetPostedStatus(nextQualityCheck)) {
        return NextResponse.json(
          { success: false, error: getPostedBlockedMessage(nextQualityCheck) },
          { status: 400 }
        );
      }
      patch.status = body.status;
    }

    const updated = updateVkTask(tasks, id, patch);

    if (!updated) {
      return NextResponse.json({ success: false, error: "Задача не найдена" }, { status: 404 });
    }

    writeVkTasksFile(tasks);

    const statusChanged = patch.status !== undefined && patch.status !== existing.status;
    appendVkTaskLogEntry({
      taskId: id,
      action: statusChanged ? "status_changed" : "updated",
      oldStatus: existing.status,
      newStatus: updated.status,
      assignedAccount: updated.assignedAccount,
      vkUrl: updated.vkUrl,
      vkGroupId: updated.vkGroupId,
      message: statusChanged
        ? `Статус: ${existing.status} → ${updated.status}`
        : "Ручное обновление",
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить задачу";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const accountGroup =
      body.accountGroup === "all" || body.accountGroup === undefined
        ? "all"
        : isAccountGroup(body.accountGroup)
          ? body.accountGroup
          : null;

    if (accountGroup === null) {
      return NextResponse.json({ success: false, error: "Некорректная accountGroup" }, { status: 400 });
    }

    const count = typeof body.count === "number" && body.count > 0 ? Math.min(body.count, 50) : 10;

    const assignedAccount = [
      typeof body.assignedAccount === "string" ? body.assignedAccount.trim() : "",
      typeof body.accountId === "string" ? body.accountId.trim() : "",
      typeof body.selectedAccountId === "string" ? body.selectedAccountId.trim() : "",
    ].find(Boolean) ?? "";

    if (!assignedAccount) {
      return NextResponse.json(
        { success: false, error: "Аккаунт обязателен (assignedAccount / accountId / selectedAccountId)" },
        { status: 400 }
      );
    }

    const accounts = readVkAccountsFile();
    const account = getVkAccountById(assignedAccount, accounts);

    if (!account) {
      return NextResponse.json({ success: false, error: "Аккаунт не найден" }, { status: 400 });
    }

    if (account.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Можно выдавать задачи только на active-аккаунт" },
        { status: 400 }
      );
    }

    if (!isAccountEligibleForAssignment(account)) {
      return NextResponse.json(
        {
          success: false,
          error: "Аккаунт не авторизован (authStatus должен быть connected)",
        },
        { status: 400 }
      );
    }

    const tasks = readVkTasksFile();
    const availableCount = getAvailableTakeCount(tasks, account, count);

    if (availableCount <= 0) {
      appendVkTaskLogEntry({
        taskId: "",
        action: "error",
        oldStatus: "",
        newStatus: "",
        assignedAccount,
        vkUrl: "",
        vkGroupId: "",
        message: "Лимит аккаунта исчерпан",
      });

      return NextResponse.json(
        { success: false, error: "Лимит аккаунта исчерпан" },
        { status: 400 }
      );
    }

    const taken = takeVkTasks(tasks, {
      accountGroup,
      count: availableCount,
      assignedAccount,
    });

    if (taken.length === 0) {
      return NextResponse.json({
        success: true,
        tasks: [],
        message: "Нет новых задач для выдачи",
      });
    }

    writeVkTasksFile(tasks);

    const partial = taken.length < count;
    const batchMessage = partial
      ? `Взято задач: ${taken.length} (доступно по лимиту, запрошено ${count})`
      : `Выдано задач: ${taken.length}`;

    appendVkTaskLogEntries(
      taken.map((task) => ({
        taskId: task.id,
        action: "assigned",
        oldStatus: "new",
        newStatus: "need_vk_url",
        assignedAccount,
        vkUrl: task.vkUrl,
        vkGroupId: task.vkGroupId,
        message: batchMessage,
      }))
    );

    const message = partial
      ? `Взято задач: ${taken.length} (доступно по лимиту, запрошено ${count})`
      : undefined;

    return NextResponse.json({
      success: true,
      tasks: taken,
      count: taken.length,
      requested: count,
      ...(message ? { message } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось взять задачи";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function parseBulkUpdateItem(raw: unknown): VkTaskBulkUpdate | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";

  if (!id) return null;

  const update: VkTaskBulkUpdate = { id };

  if (typeof item.vkUrl === "string" && item.vkUrl.trim()) {
    update.vkUrl = item.vkUrl.trim();
  }
  if (typeof item.vkGroupId === "string" && item.vkGroupId.trim()) {
    update.vkGroupId = item.vkGroupId.trim();
  }
  if (typeof item.assignedAccount === "string" && item.assignedAccount.trim()) {
    update.assignedAccount = item.assignedAccount.trim();
  }
  if (typeof item.status === "string" && item.status.trim()) {
    const status = item.status.trim();
    if (!isTaskStatus(status)) {
      return null;
    }
    update.status = status;
  }

  return update;
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "Ожидается массив обновлений" },
        { status: 400 }
      );
    }

    const updates: VkTaskBulkUpdate[] = [];
    const invalid: string[] = [];

    for (const raw of body) {
      const item = raw as Record<string, unknown>;
      const id = typeof item?.id === "string" ? item.id.trim() : "";

      if (typeof item?.status === "string" && item.status.trim() && !isTaskStatus(item.status.trim())) {
        invalid.push(id || "(без id)");
        continue;
      }

      const parsed = parseBulkUpdateItem(raw);
      if (!parsed) {
        if (id) invalid.push(id);
        continue;
      }

      updates.push(parsed);
    }

    if (invalid.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Некорректный status для: ${invalid.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "Нет валидных обновлений" },
        { status: 400 }
      );
    }

    const tasks = readVkTasksFile();
    const beforeMap = new Map(tasks.map((task) => [task.id, task]));
    const result = bulkUpdateVkTasks(tasks, updates);
    const resolveWarnings: string[] = [];

    for (const update of updates) {
      if (result.notFound.includes(update.id)) continue;

      const task = tasks.find((item) => item.id === update.id);
      if (!task || !taskNeedsVkUrlResolve(task)) continue;

      const accountId = task.assignedAccount.trim();
      if (!accountId) {
        resolveWarnings.push(`${task.id}: vkUrl без vkGroupId — assignedAccount не задан`);
        continue;
      }

      try {
        const resolved = await resolveAndUpdateVkTask({
          taskId: task.id,
          vkUrl: task.vkUrl,
          accountId,
          save: false,
        });
        const index = tasks.findIndex((item) => item.id === task.id);
        if (index >= 0 && resolved.resolve.resolved) {
          tasks[index] = resolved.task;
        } else if (!resolved.resolve.resolved) {
          resolveWarnings.push(`${task.id}: ${resolved.resolve.error || "resolve failed"}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "resolve failed";
        resolveWarnings.push(`${task.id}: ${message}`);
      }
    }

    writeVkTasksFile(tasks);

    const logEntries = updates
      .filter((update) => !result.notFound.includes(update.id))
      .map((update) => {
        const before = beforeMap.get(update.id);
        const after = tasks.find((task) => task.id === update.id);
        if (!before || !after) return null;

        return {
          taskId: update.id,
          action: "bulk_import" as const,
          oldStatus: before.status,
          newStatus: after.status,
          assignedAccount: after.assignedAccount,
          vkUrl: after.vkUrl,
          vkGroupId: after.vkGroupId,
          message: "Массовое обновление",
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (logEntries.length > 0) {
      appendVkTaskLogEntries(logEntries);
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      notFound: result.notFound,
      resolveWarnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить массовое обновление";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
