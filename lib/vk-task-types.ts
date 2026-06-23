import type { VkAccountGroup } from "./vk-types";
import type { VkTaskQualityCheck } from "./vk-quality-check";
import { DEFAULT_QUALITY_CHECK } from "./vk-quality-check";
import type { VkTaskManualSetup } from "./vk-manual-setup";
import type { VkTaskContentPack } from "./vk-content-pack";
import type { VkTaskImageAssets } from "./vk-image-assets-types";

export type VkTaskStatus =
  | "new"
  | "in_progress"
  | "need_vk_url"
  | "created"
  | "ready_for_worker"
  | "filled"
  | "posted"
  | "error";

export const VK_TASK_STATUSES: VkTaskStatus[] = [
  "new",
  "in_progress",
  "need_vk_url",
  "created",
  "ready_for_worker",
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
  manualCreated: boolean;
  lastBindBatchId: string;
  qualityCheck: VkTaskQualityCheck;
  manualSetup: VkTaskManualSetup;
  contentPack: VkTaskContentPack;
  imageAssets: VkTaskImageAssets;
  status: VkTaskStatus;
  createdAt: string;
  updatedAt: string;
}

export const VK_TASK_STATUS_LABELS: Record<VkTaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  need_vk_url: "Нужна VK ссылка",
  created: "Создано",
  ready_for_worker: "Готово к запуску",
  filled: "Заполнено",
  posted: "Опубликовано",
  error: "Ошибка",
};
