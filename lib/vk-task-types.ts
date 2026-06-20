import type { VkAccountGroup } from "./vk-types";
import type { VkTaskQualityCheck } from "./vk-quality-check";
import { DEFAULT_QUALITY_CHECK } from "./vk-quality-check";
import type { VkTaskContentPack } from "./vk-content-pack";

export type VkTaskStatus =
  | "new"
  | "in_progress"
  | "created"
  | "filled"
  | "posted"
  | "error";

export const VK_TASK_STATUSES: VkTaskStatus[] = [
  "new",
  "in_progress",
  "created",
  "filled",
  "posted",
  "error",
];

export interface VkTask {
  id: string;
  accountGroup: VkAccountGroup;
  city: string;
  service: string;
  slug: string;
  phone: string;
  siteUrl: string;
  vkName: string;
  vkDescription: string;
  vkStatus: string;
  vkFirstPost: string;
  vkKeywords: string;
  vkUrl: string;
  vkGroupId: string;
  assignedAccount: string;
  assignedAt: string;
  qualityCheck: VkTaskQualityCheck;
  contentPack: VkTaskContentPack;
  status: VkTaskStatus;
  createdAt: string;
  updatedAt: string;
}

export const VK_TASK_STATUS_LABELS: Record<VkTaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  created: "Создано",
  filled: "Заполнено",
  posted: "Опубликовано",
  error: "Ошибка",
};
