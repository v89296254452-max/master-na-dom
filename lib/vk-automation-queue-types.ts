export const VK_AUTOMATION_ACTIONS = [
  "login_account",
  "create_group",
  "need_manual_create",
  "need_manual_check",
  "setup_group",
  "fill_description",
  "upload_avatar",
  "upload_cover",
  "publish_pinned_post",
  "publish_post",
  "save_result",
] as const;

export type VkAutomationAction = (typeof VK_AUTOMATION_ACTIONS)[number];

export const VK_AUTOMATION_ACTION_LABELS: Record<VkAutomationAction, string> = {
  login_account: "Вход в аккаунт",
  create_group: "Создание группы",
  need_manual_create: "Нужно создать группу вручную",
  need_manual_check: "Не удалось распознать vkGroupId",
  setup_group: "Настройка группы",
  fill_description: "Заполнение описания (устарело)",
  upload_avatar: "Загрузка аватара",
  upload_cover: "Загрузка обложки",
  publish_pinned_post: "Публикация закреплённого поста",
  publish_post: "Публикация поста",
  save_result: "Сохранение результата",
};

export type VkAutomationJobStatus = "pending" | "running" | "success" | "failed" | "skipped";

export const VK_AUTOMATION_JOB_STATUSES: VkAutomationJobStatus[] = [
  "pending",
  "running",
  "success",
  "failed",
  "skipped",
];

export const VK_AUTOMATION_JOB_STATUS_LABELS: Record<VkAutomationJobStatus, string> = {
  pending: "Pending",
  running: "Running",
  success: "Success",
  failed: "Failed",
  skipped: "Skipped",
};

export interface VkAutomationQueueStats {
  total: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  skipped: number;
}

export interface VkAutomationJob {
  id: string;
  taskId: string;
  accountId: string;
  action: VkAutomationAction;
  status: VkAutomationJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  completedAt: string;
}

export interface VkAutomationJobClaimResult {
  job: VkAutomationJob | null;
}

export interface VkAutomationJobCompleteInput {
  jobId: string;
  status: "success" | "failed" | "skipped";
  result?: Record<string, unknown>;
  error?: string;
  retry?: boolean;
  maxAttempts?: number;
}

export type VkWorkerMode = "mock" | "real";

export const VK_WORKER_MODES: VkWorkerMode[] = ["mock", "real"];

export interface VkAutomationGenerateResult {
  created: number;
  skipped: number;
  removed?: number;
  tasksUsed?: number;
  taskIds?: string[];
  errors: string[];
  stats: VkAutomationQueueStats;
}

export interface VkAutomationClearResult {
  removed: number;
  stats: VkAutomationQueueStats;
}

export interface VkAutomationReadinessStats {
  readyForWorkerTasks: number;
  readyForWorkerStrict: number;
  readyForWorkerEligible: number;
  brokenReadyWithoutGroupId: number;
  manualSetupIncompleteStrict: number;
  groupsCreated: number;
  needManualCheck: number;
}

export const VK_AUTOMATION_MANUAL_GROUP_MODE = true;
