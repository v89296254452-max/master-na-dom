import { isAccountEligibleForAssignment } from "./vk-account-auth";
import type { VkAccount } from "./vk-account-types";
import type { VkAutomationJob, VkAutomationReadinessStats } from "./vk-automation-queue-types";
import type { VkTask } from "./vk-task-types";
import {
  countBrokenReadyWithoutGroupId,
  isReadyForWorkerStatus,
  taskHasVkUrlWithoutGroupId,
  taskMeetsReadyForWorkerStrict,
} from "./vk-task-status";
import { isManualSetupPrepared } from "./vk-manual-setup";

export function taskHasVkGroupId(task: Pick<VkTask, "vkGroupId">): boolean {
  return task.vkGroupId.trim().length > 0;
}

export function taskHasManualGroupInfo(task: Pick<VkTask, "vkGroupId">): boolean {
  return task.vkGroupId.trim().length > 0;
}

export function isAutomationTargetStatus(status: VkTask["status"]): boolean {
  return isReadyForWorkerStatus(status);
}

/** Strict ready_for_worker — единое правило для eligible / очереди / worker. */
export function isTaskReadyForWorker(task: VkTask, accounts: VkAccount[]): boolean {
  if (!isAutomationTargetStatus(task.status)) {
    return false;
  }

  if (!isManualSetupPrepared(task.manualSetup)) {
    return false;
  }

  return taskMeetsReadyForWorkerStrict(task, accounts);
}

export function explainTaskNotStrictReady(task: VkTask, accounts: VkAccount[]): string {
  const taskId = task.id;

  if (!isManualSetupPrepared(task.manualSetup)) {
    return `${taskId}: группа не подготовлена (manualSetup.prepared = false)`;
  }

  if (!task.vkGroupId.trim()) {
    return `${taskId}: vkGroupId не заполнен`;
  }
  if (!task.assignedAccount.trim()) {
    return `${taskId}: assignedAccount не заполнен`;
  }

  const account = accounts.find((item) => item.id === task.assignedAccount.trim());
  if (!account) {
    return `${taskId}: аккаунт "${task.assignedAccount}" не найден`;
  }
  if (account.status !== "active") {
    return `${taskId}: account.status = ${account.status}, нужен active`;
  }
  if (account.authStatus !== "connected") {
    return `${taskId}: account.authStatus = ${account.authStatus}, нужен connected`;
  }
  if (task.status !== "ready_for_worker") {
    return `${taskId}: status = ${task.status}, нужен ready_for_worker`;
  }

  return `${taskId}: не проходит strict ready_for_worker`;
}

export function getStrictReadyTasks(tasks: VkTask[], accounts: VkAccount[]): VkTask[] {
  return tasks.filter((task) => isTaskReadyForWorker(task, accounts));
}

export function getAutomationTargetTasks(
  tasks: VkTask[],
  accounts: VkAccount[],
  taskIds?: string[]
): VkTask[] {
  let filtered = tasks.filter((task) => isTaskReadyForWorker(task, accounts));

  if (taskIds && taskIds.length > 0) {
    const idSet = new Set(taskIds);
    filtered = filtered.filter((task) => idSet.has(task.id));
  }

  return filtered;
}

export type { VkAutomationReadinessStats };

export function computeAutomationReadinessStats(
  tasks: VkTask[],
  _jobs: VkAutomationJob[],
  accounts: VkAccount[]
): VkAutomationReadinessStats {
  const readyTasks = tasks.filter((task) => task.status === "ready_for_worker");
  const strictReady = tasks.filter((task) => isTaskReadyForWorker(task, accounts));

  return {
    readyForWorkerTasks: readyTasks.length,
    readyForWorkerStrict: strictReady.length,
    readyForWorkerEligible: strictReady.length,
    brokenReadyWithoutGroupId: countBrokenReadyWithoutGroupId(tasks),
    manualSetupIncompleteStrict: tasks.filter(
      (task) =>
        taskMeetsReadyForWorkerStrict(task, accounts) && !isManualSetupPrepared(task.manualSetup)
    ).length,
    groupsCreated: tasks.filter((task) => task.status === "created").length,
    needManualCheck: tasks.filter((task) => taskHasVkUrlWithoutGroupId(task)).length,
  };
}
