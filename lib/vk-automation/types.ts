export const VK_BROWSER_ACCOUNT_STATUSES = ["active", "paused", "banned", "problem"] as const;
export type VkBrowserAccountStatus = (typeof VK_BROWSER_ACCOUNT_STATUSES)[number];

export const VK_BROWSER_AUTH_STATUSES = [
  "not_connected",
  "connected",
  "expired",
  "error",
  "manual_pending",
] as const;
export type VkBrowserAuthStatus = (typeof VK_BROWSER_AUTH_STATUSES)[number];

export const VK_BROWSER_JOB_ACTIONS = [
  "auth_open",
  "auth_check",
  "create_test_group",
  "create_group",
  "create_group_full",
  "fill_group",
  "publish_post",
] as const;
export type VkBrowserJobAction = (typeof VK_BROWSER_JOB_ACTIONS)[number];

export const VK_BROWSER_JOB_STATUSES = [
  "pending",
  "running",
  "success",
  "failed",
  "skipped",
] as const;
export type VkBrowserJobStatus = (typeof VK_BROWSER_JOB_STATUSES)[number];

export const VK_BROWSER_TASK_STATUSES = [
  "pending",
  "running",
  "success",
  "failed",
  "skipped",
] as const;
export type VkBrowserTaskStatus = (typeof VK_BROWSER_TASK_STATUSES)[number];

export interface VkBrowserAccount {
  id: string;
  login: string;
  password: string;
  proxy: string;
  status: VkBrowserAccountStatus;
  authStatus: VkBrowserAuthStatus;
  sessionPath: string;
  profilePath: string;
  lastUse: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface VkBrowserCity {
  id: number;
  name: string;
  region: string;
  used: number;
}

export interface VkBrowserGroup {
  id: number;
  accountId: string;
  taskId: number | null;
  name: string;
  vkUrl: string;
  vkGroupId: string;
  description: string;
  city: string;
  phone: string;
  status: string;
  createdAt: string;
}

export interface VkBrowserTask {
  id: number;
  accountId: string;
  cityId: number | null;
  phone: string;
  groupName: string;
  status: VkBrowserTaskStatus;
  payload: Record<string, unknown>;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface VkBrowserJob {
  id: string;
  accountId: string;
  taskId: number | null;
  action: VkBrowserJobAction;
  status: VkBrowserJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  completedAt: string;
}

export interface VkBrowserLogEntry {
  id: number;
  jobId: string;
  accountId: string;
  level: "info" | "warn" | "error";
  message: string;
  screenshotPath: string;
  createdAt: string;
}

export interface VkBrowserQueueStats {
  total: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  skipped: number;
}

export const VK_BROWSER_ACTION_LABELS: Record<VkBrowserJobAction, string> = {
  auth_open: "Открыть авторизацию",
  auth_check: "Проверить авторизацию",
  create_test_group: "Создать тестовую группу",
  create_group: "Создать группу",
  create_group_full: "Создать группу (master-data)",
  fill_group: "Заполнить группу",
  publish_post: "Опубликовать пост",
};

export const VK_BROWSER_AUTH_STATUS_LABELS: Record<VkBrowserAuthStatus, string> = {
  not_connected: "Не подключён",
  connected: "Подключён",
  expired: "Истёк",
  error: "Ошибка",
  manual_pending: "Ожидает ручного входа",
};
