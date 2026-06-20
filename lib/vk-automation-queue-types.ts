export const VK_AUTOMATION_ACTIONS = [
  "login_account",
  "create_group",
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
  fill_description: "Заполнение описания",
  upload_avatar: "Загрузка аватара",
  upload_cover: "Загрузка обложки",
  publish_pinned_post: "Публикация закреплённого поста",
  publish_post: "Публикация поста",
  save_result: "Сохранение результата",
};

export type VkAutomationJobStatus = "pending" | "running" | "success" | "failed";

export const VK_AUTOMATION_JOB_STATUSES: VkAutomationJobStatus[] = [
  "pending",
  "running",
  "success",
  "failed",
];

export interface VkAutomationJob {
  id: string;
  taskId: string;
  accountId: string;
  action: VkAutomationAction;
  status: VkAutomationJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string;
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
  status: "success" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}
