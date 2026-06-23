import { computeAutomationReadinessStats, getStrictReadyTasks, taskHasVkGroupId } from "./vk-automation-readiness";
import { readVkAccountsFile } from "./vk-accounts";
import { appendVkTaskLogEntries } from "./vk-task-log";
import type { VkTask } from "./vk-task-types";
import { readVkTasksFile } from "./vk-tasks";
import {
  canPromoteToReadyForWorker,
  countBrokenReadyWithoutGroupId,
  taskHasVkUrlWithoutGroupId,
  taskMeetsReadyForWorkerStrict,
} from "./vk-task-status";
import type { VkTaskStatusSnapshot } from "./vk-task-status-types";

export type { VkTaskStatusSnapshot };

export function getVkTaskStatusSnapshot(): VkTaskStatusSnapshot {
  const tasks = readVkTasksFile();
  const accounts = readVkAccountsFile();
  const readiness = computeAutomationReadinessStats(tasks, [], accounts);

  return {
    readyForWorkerTasks: readiness.readyForWorkerTasks,
    readyForWorkerStrict: readiness.readyForWorkerStrict,
    readyForWorkerEligible: readiness.readyForWorkerEligible,
    brokenReadyWithoutGroupId: countBrokenReadyWithoutGroupId(tasks),
    vkUrlNoGroupId: tasks.filter((task) => taskHasVkUrlWithoutGroupId(task)).length,
    needManualCheck: readiness.needManualCheck,
    groupsCreated: readiness.groupsCreated,
    vkUrlNoGroupIdTaskIds: tasks
      .filter((task) => taskHasVkUrlWithoutGroupId(task))
      .map((task) => task.id),
    strictReadyTaskIds: getStrictReadyTasks(tasks, accounts).map((task) => task.id),
  };
}

export function promoteEligibleTasksToReady(tasks: VkTask[], accounts: ReturnType<typeof readVkAccountsFile>): number {
  let promoted = 0;
  const timestamp = new Date().toISOString();

  for (const task of tasks) {
    if (!canPromoteToReadyForWorker(task, accounts)) continue;

    task.status = "ready_for_worker";
    task.updatedAt = timestamp;
    promoted += 1;
  }

  return promoted;
}

/**
 * Понижает ready_for_worker без vkGroupId (и другие broken strict) → created.
 * Логирует need_manual_check для отсутствующего vkGroupId.
 */
export function reconcileBrokenReadyForWorkerTasks(
  tasks: VkTask[],
  accounts: ReturnType<typeof readVkAccountsFile>
): number {
  const timestamp = new Date().toISOString();
  const logEntries: Parameters<typeof appendVkTaskLogEntries>[0] = [];
  let demoted = 0;

  for (const task of tasks) {
    if (task.status !== "ready_for_worker") continue;
    if (taskMeetsReadyForWorkerStrict(task, accounts)) continue;

    const oldStatus = task.status;
    task.status = "created";
    task.updatedAt = timestamp;
    demoted += 1;

    const message = !task.vkGroupId.trim()
      ? "need_manual_check: vkGroupId отсутствует"
      : "need_manual_check: задача не проходит strict ready_for_worker";

    logEntries.push({
      taskId: task.id,
      action: "updated",
      oldStatus,
      newStatus: task.status,
      assignedAccount: task.assignedAccount,
      vkUrl: task.vkUrl,
      vkGroupId: task.vkGroupId,
      message,
    });
  }

  if (logEntries.length > 0) {
    appendVkTaskLogEntries(logEntries);
  }

  return demoted;
}
