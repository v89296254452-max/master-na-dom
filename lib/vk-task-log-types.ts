export type VkTaskLogAction =
  | "assigned"
  | "updated"
  | "status_changed"
  | "bulk_import"
  | "error";

export const VK_TASK_LOG_ACTIONS: VkTaskLogAction[] = [
  "assigned",
  "updated",
  "status_changed",
  "bulk_import",
  "error",
];

export const VK_TASK_LOG_ACTION_LABELS: Record<VkTaskLogAction, string> = {
  assigned: "Выдача",
  updated: "Обновление",
  status_changed: "Смена статуса",
  bulk_import: "Массовый импорт",
  error: "Ошибка",
};

export interface VkTaskLogEntry {
  id: string;
  taskId: string;
  action: VkTaskLogAction;
  oldStatus: string;
  newStatus: string;
  assignedAccount: string;
  vkUrl: string;
  vkGroupId: string;
  message: string;
  createdAt: string;
}

export type VkTaskLogInput = Omit<VkTaskLogEntry, "id" | "createdAt">;

export interface VkTaskLogFilters {
  taskId?: string;
  accountId?: string;
  action?: VkTaskLogAction;
  date?: string;
}
