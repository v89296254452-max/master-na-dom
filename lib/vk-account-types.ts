export type VkAccountStatus = "active" | "paused" | "banned" | "problem";

export const VK_ACCOUNT_STATUSES: VkAccountStatus[] = [
  "active",
  "paused",
  "banned",
  "problem",
];

export const VK_ACCOUNT_STATUS_LABELS: Record<VkAccountStatus, string> = {
  active: "Активен",
  paused: "Пауза",
  banned: "Заблокирован",
  problem: "Проблема",
};

export type VkAccountAuthStatus = "not_connected" | "connected" | "expired" | "error";

export const VK_ACCOUNT_AUTH_STATUSES: VkAccountAuthStatus[] = [
  "not_connected",
  "connected",
  "expired",
  "error",
];

export const VK_ACCOUNT_AUTH_STATUS_LABELS: Record<VkAccountAuthStatus, string> = {
  not_connected: "Не подключён",
  connected: "Подключён",
  expired: "Истёк",
  error: "Ошибка",
};

export interface VkAccount {
  id: string;
  name: string;
  phone: string;
  status: VkAccountStatus;
  authStatus: VkAccountAuthStatus;
  vkUserId: string;
  vkProfileUrl: string;
  accessToken: string;
  tokenExpiresAt: string;
  lastAuthCheckAt: string;
  lastAuthError: string;
  dailyLimit: number;
  totalLimit: number;
  notes: string;
}

export interface VkAccountStats {
  total: number;
  in_progress: number;
  need_vk_url: number;
  created: number;
  filled: number;
  posted: number;
  error: number;
}

export interface VkAccountLimitStats {
  assignedToday: number;
  assignedTotal: number;
  dailyRemaining: number;
  totalRemaining: number;
}

export interface VkAccountWithStats extends VkAccount {
  stats: VkAccountStats;
  limits: VkAccountLimitStats;
}

export const DEFAULT_VK_ACCOUNT_AUTH: Pick<
  VkAccount,
  | "authStatus"
  | "vkUserId"
  | "vkProfileUrl"
  | "accessToken"
  | "tokenExpiresAt"
  | "lastAuthCheckAt"
  | "lastAuthError"
> = {
  authStatus: "not_connected",
  vkUserId: "",
  vkProfileUrl: "",
  accessToken: "",
  tokenExpiresAt: "",
  lastAuthCheckAt: "",
  lastAuthError: "",
};

