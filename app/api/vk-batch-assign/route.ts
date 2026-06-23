import { NextResponse } from "next/server";
import type { VkAccountGroup } from "@/lib/vk-types";
import { batchAssignVkTasks } from "@/lib/vk-batch-assign";
import type { VkBatchAssignStrategy } from "@/lib/vk-batch-assign-types";
import { VK_BATCH_ASSIGN_STRATEGIES } from "@/lib/vk-batch-assign-types";
import { isAccountEligibleForAssignment } from "@/lib/vk-account-auth";
import { readVkAccountsFile } from "@/lib/vk-accounts";
import { appendVkTaskLogEntries } from "@/lib/vk-task-log";
import { readVkTasksFile, writeVkTasksFile } from "@/lib/vk-tasks";

function isAccountGroup(value: unknown): value is VkAccountGroup {
  return value === "kp" || value === "bt" || value === "mnch";
}

function isStrategy(value: unknown): value is VkBatchAssignStrategy {
  return typeof value === "string" && VK_BATCH_ASSIGN_STRATEGIES.includes(value as VkBatchAssignStrategy);
}

export async function POST(request: Request) {
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

    const strategy = isStrategy(body.strategy) ? body.strategy : "even";
    const count =
      typeof body.count === "number" && body.count > 0 ? Math.min(Math.floor(body.count), 500) : 50;

    const accounts = readVkAccountsFile();
    const eligibleAccounts = accounts.filter((account) => isAccountEligibleForAssignment(account));

    if (eligibleAccounts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Нет active-аккаунтов с authStatus=connected для распределения",
        },
        { status: 400 }
      );
    }

    const tasks = readVkTasksFile();

    const result = batchAssignVkTasks(tasks, accounts, {
      accountGroup,
      count,
      strategy,
    });

    if (result.assignedTotal === 0) {
      return NextResponse.json({
        success: true,
        result,
        message: "Нет задач или доступного лимита для распределения",
      });
    }

    writeVkTasksFile(tasks);

    const assignedTasks = tasks.filter((task) => result.assignedTaskIds.includes(task.id));

    appendVkTaskLogEntries(
      assignedTasks.map((task) => ({
        taskId: task.id,
        action: "assigned" as const,
        oldStatus: "new",
        newStatus: "need_vk_url",
        assignedAccount: task.assignedAccount,
        vkUrl: task.vkUrl,
        vkGroupId: task.vkGroupId,
        message: "Batch assignment",
      }))
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось распределить задачи";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
