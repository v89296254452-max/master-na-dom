import type { VkAccountGroup } from "./vk-types";
import type { VkTaskStatus } from "./vk-task-types";
import type { VkDashboardAuthStats } from "./vk-account-auth";

export type { VkDashboardAuthStats };
export interface VkDashboardOverall {
  total: number;
  groupsCreated: number;
  readyForWorker: number;
  posted: number;
  error: number;
  completionPercent: number;
  /** @deprecated legacy breakdown */
  new?: number;
  in_progress?: number;
  need_vk_url?: number;
  created?: number;
  filled?: number;
}

export interface VkDashboardGroupStats {
  group: VkAccountGroup;
  label: string;
  total: number;
  posted: number;
  error: number;
  completionPercent: number;
}

export interface VkDashboardAccountStats {
  accountId: string;
  accountName: string;
  assigned: number;
  created: number;
  filled: number;
  posted: number;
  error: number;
}

export interface VkDashboardToday {
  created: number;
  filled: number;
  posted: number;
}

export interface VkDashboardForecast {
  hasActivity: boolean;
  avgPostedPerDay: number;
  remaining: number;
  forecastDays: number | null;
}

export interface VkDashboardQuality {
  fullChecklist: number;
  partialChecklist: number;
  avgFillPercent: number;
}

export interface VkDashboardDuplicates {
  exactDuplicates: number;
  similarTexts: number;
  cleanTasks: number;
}

export interface VkDashboardData {
  overall: VkDashboardOverall;
  groups: VkDashboardGroupStats[];
  accounts: VkDashboardAccountStats[];
  auth: VkDashboardAuthStats;
  today: VkDashboardToday;
  forecast: VkDashboardForecast;
  quality: VkDashboardQuality;
  duplicates: VkDashboardDuplicates;
}

export const VK_DASHBOARD_TRACKED_STATUSES: VkTaskStatus[] = ["created", "filled", "posted"];
