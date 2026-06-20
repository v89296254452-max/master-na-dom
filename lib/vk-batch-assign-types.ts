import type { VkAccountGroup } from "./vk-types";

export type VkBatchAssignStrategy = "even" | "fillFirst" | "roundRobin";

export const VK_BATCH_ASSIGN_STRATEGIES: VkBatchAssignStrategy[] = [
  "even",
  "fillFirst",
  "roundRobin",
];

export const VK_BATCH_ASSIGN_STRATEGY_LABELS: Record<VkBatchAssignStrategy, string> = {
  even: "Равномерно",
  fillFirst: "Сначала заполнить первый аккаунт",
  roundRobin: "По кругу",
};

export interface VkBatchAssignOptions {
  accountGroup: VkAccountGroup | "all";
  count: number;
  strategy: VkBatchAssignStrategy;
}

export interface VkBatchAssignAccountResult {
  accountId: string;
  accountName: string;
  assigned: number;
}

export interface VkBatchAssignResult {
  assignedTotal: number;
  remainingNew: number;
  byAccount: VkBatchAssignAccountResult[];
  assignedTaskIds: string[];
}
