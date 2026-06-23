import type { VkUrlBindMode } from "./vk-url-bind";

/** Client-safe bind batch record from GET /api/vk-url-bind-batches */
export interface VkUrlBindBatchSummary {
  batchId: string;
  createdAt: string;
  accountId: string;
  mode: VkUrlBindMode;
  linksTotal: number;
  tasksUpdated: number;
  taskIds: string[];
}
