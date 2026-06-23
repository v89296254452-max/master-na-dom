import type { VkAccount } from "./vk-account-types";
import { isAccountEligibleForAssignment } from "./vk-account-auth";
import { computeAccountLimitUsage } from "./vk-accounts";
import type { VkBatchAssignOptions, VkBatchAssignResult } from "./vk-batch-assign-types";
import type { VkTask } from "./vk-task-types";
import { updateVkTask } from "./vk-tasks";
import type { VkAccountGroup } from "./vk-types";

interface AccountSlot {
  account: VkAccount;
  dailyRemaining: number;
  totalRemaining: number;
  assignedInBatch: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function initAccountSlots(accounts: VkAccount[], tasks: VkTask[]): AccountSlot[] {
  return accounts
    .filter((account) => isAccountEligibleForAssignment(account))
    .map((account) => {
      const limits = computeAccountLimitUsage(tasks, account);
      return {
        account,
        dailyRemaining: limits.dailyRemaining,
        totalRemaining: limits.totalRemaining,
        assignedInBatch: 0,
      };
    })
    .filter((slot) => slot.dailyRemaining > 0 && slot.totalRemaining > 0);
}

function canAssignToSlot(slot: AccountSlot): boolean {
  return slot.dailyRemaining > 0 && slot.totalRemaining > 0;
}

function filterNewTasks(tasks: VkTask[], accountGroup: VkAccountGroup | "all"): VkTask[] {
  return tasks.filter((task) => {
    if (task.status !== "new") return false;
    if (accountGroup !== "all" && task.accountGroup !== accountGroup) return false;
    return true;
  });
}

function countNewTasks(tasks: VkTask[], accountGroup: VkAccountGroup | "all"): number {
  return filterNewTasks(tasks, accountGroup).length;
}

function assignTaskToSlot(
  tasks: VkTask[],
  slot: AccountSlot,
  task: VkTask,
  assignedAt: string
): VkTask | null {
  const updated = updateVkTask(tasks, task.id, {
    status: "need_vk_url",
    assignedAccount: slot.account.id,
    assignedAt,
  });

  if (!updated) return null;

  slot.dailyRemaining -= 1;
  slot.totalRemaining -= 1;
  slot.assignedInBatch += 1;
  return updated;
}

function runFillFirst(
  tasks: VkTask[],
  slots: AccountSlot[],
  newTasks: VkTask[],
  maxCount: number,
  assignedAt: string
): VkTask[] {
  const assigned: VkTask[] = [];
  let queueIndex = 0;

  for (const slot of slots) {
    while (canAssignToSlot(slot) && queueIndex < newTasks.length && assigned.length < maxCount) {
      const result = assignTaskToSlot(tasks, slot, newTasks[queueIndex], assignedAt);
      if (!result) continue;
      assigned.push(result);
      queueIndex += 1;
    }
    if (assigned.length >= maxCount) break;
  }

  return assigned;
}

function runRoundRobin(
  tasks: VkTask[],
  slots: AccountSlot[],
  newTasks: VkTask[],
  maxCount: number,
  assignedAt: string
): VkTask[] {
  const assigned: VkTask[] = [];
  let queueIndex = 0;
  let slotIndex = 0;

  while (assigned.length < maxCount && queueIndex < newTasks.length) {
    let assignedInCycle = false;

    for (let offset = 0; offset < slots.length; offset += 1) {
      const slot = slots[(slotIndex + offset) % slots.length];
      if (!canAssignToSlot(slot)) continue;
      if (queueIndex >= newTasks.length || assigned.length >= maxCount) break;

      const result = assignTaskToSlot(tasks, slot, newTasks[queueIndex], assignedAt);
      queueIndex += 1;
      if (!result) continue;

      assigned.push(result);
      assignedInCycle = true;
      slotIndex = (slotIndex + offset + 1) % slots.length;
      break;
    }

    if (!assignedInCycle) break;
  }

  return assigned;
}

function runEven(
  tasks: VkTask[],
  slots: AccountSlot[],
  newTasks: VkTask[],
  maxCount: number,
  assignedAt: string
): VkTask[] {
  const assigned: VkTask[] = [];
  let queueIndex = 0;

  while (assigned.length < maxCount && queueIndex < newTasks.length) {
    const available = slots
      .filter(canAssignToSlot)
      .sort((a, b) => a.assignedInBatch - b.assignedInBatch);

    if (available.length === 0) break;

    const slot = available[0];
    const result = assignTaskToSlot(tasks, slot, newTasks[queueIndex], assignedAt);
    queueIndex += 1;
    if (!result) continue;
    assigned.push(result);
  }

  return assigned;
}

export function batchAssignVkTasks(
  tasks: VkTask[],
  accounts: VkAccount[],
  options: VkBatchAssignOptions
): VkBatchAssignResult {
  const slots = initAccountSlots(accounts, tasks);
  const newTasks = filterNewTasks(tasks, options.accountGroup);
  const maxCount = Math.max(0, Math.min(options.count, newTasks.length));
  const assignedAt = nowIso();

  if (slots.length === 0 || maxCount === 0) {
    return {
      assignedTotal: 0,
      remainingNew: countNewTasks(tasks, options.accountGroup),
      byAccount: [],
      assignedTaskIds: [],
    };
  }

  let assigned: VkTask[] = [];

  if (options.strategy === "fillFirst") {
    assigned = runFillFirst(tasks, slots, newTasks, maxCount, assignedAt);
  } else if (options.strategy === "roundRobin") {
    assigned = runRoundRobin(tasks, slots, newTasks, maxCount, assignedAt);
  } else {
    assigned = runEven(tasks, slots, newTasks, maxCount, assignedAt);
  }

  const byAccount = slots
    .filter((slot) => slot.assignedInBatch > 0)
    .map((slot) => ({
      accountId: slot.account.id,
      accountName: slot.account.name,
      assigned: slot.assignedInBatch,
    }));

  return {
    assignedTotal: assigned.length,
    remainingNew: countNewTasks(tasks, options.accountGroup),
    byAccount,
    assignedTaskIds: assigned.map((task) => task.id),
  };
}
