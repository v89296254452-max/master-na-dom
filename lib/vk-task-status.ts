import type { VkAccount } from "./vk-account-types";
import { isAccountEligibleForAssignment } from "./vk-account-auth";
import type { VkTask, VkTaskStatus } from "./vk-task-types";
export function taskHasGroupInfo(task: Pick<VkTask, "vkGroupId">): boolean {
  return task.vkGroupId.trim().length > 0;
}

export function taskHasVkUrlWithoutGroupId(task: Pick<VkTask, "vkUrl" | "vkGroupId">): boolean {
  return task.vkUrl.trim().length > 0 && !task.vkGroupId.trim();
}

/** Поля задачи для worker (без проверки аккаунта). vkGroupId — единственный обязательный идентификатор группы. */
export function taskMeetsReadyForWorkerFieldCriteria(
  task: Pick<VkTask, "vkGroupId" | "assignedAccount">
): boolean {
  return task.vkGroupId.trim().length > 0 && task.assignedAccount.trim().length > 0;
}

/** Strict ready_for_worker: поля + существующий active/connected аккаунт. */
export function taskMeetsReadyForWorkerStrict(
  task: Pick<VkTask, "vkGroupId" | "assignedAccount">,
  accounts: VkAccount[]
): boolean {
  if (!taskMeetsReadyForWorkerFieldCriteria(task)) {
    return false;
  }

  const account = accounts.find((item) => item.id === task.assignedAccount.trim());
  if (!account) {
    return false;
  }

  return isAccountEligibleForAssignment(account);
}

/** @deprecated alias */
export const taskMeetsReadyForWorkerCriteria = taskMeetsReadyForWorkerFieldCriteria;

export function statusAfterVkGroupLinked(
  task: Pick<VkTask, "vkGroupId" | "assignedAccount">,
  accounts: VkAccount[]
): VkTaskStatus {
  if (taskMeetsReadyForWorkerStrict(task, accounts)) {
    return "ready_for_worker";
  }

  if (taskHasGroupInfo(task)) {
    return "created";
  }

  return "new";
}

export function isReadyForWorkerStatus(status: VkTaskStatus): boolean {
  return status === "ready_for_worker";
}

const PROMOTABLE_STATUSES: VkTaskStatus[] = ["created", "in_progress", "need_vk_url"];

export function canPromoteToReadyForWorker(task: VkTask, accounts: VkAccount[]): boolean {
  return PROMOTABLE_STATUSES.includes(task.status) && taskMeetsReadyForWorkerStrict(task, accounts);
}

export function countBrokenReadyWithoutGroupId(tasks: VkTask[]): number {
  return tasks.filter((task) => task.status === "ready_for_worker" && !task.vkGroupId.trim()).length;
}
