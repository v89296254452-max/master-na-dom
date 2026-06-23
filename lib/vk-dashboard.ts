import type { VkAccount } from "./vk-account-types";
import { readVkAccountsFile } from "./vk-accounts";
import type { VkTaskLogEntry } from "./vk-task-log-types";
import { readVkTaskLogFile } from "./vk-task-log";
import type { VkTask, VkTaskStatus } from "./vk-task-types";
import { readVkTasksFile } from "./vk-tasks";
import type { VkAccountGroup } from "./vk-types";
import type {
  VkDashboardAccountStats,
  VkDashboardAuthStats,
  VkDashboardData,
  VkDashboardDuplicates,
  VkDashboardForecast,
  VkDashboardGroupStats,
  VkDashboardOverall,
  VkDashboardQuality,
  VkDashboardToday,
} from "./vk-dashboard-types";
import { VK_DASHBOARD_TRACKED_STATUSES } from "./vk-dashboard-types";
import { findDuplicateIssues } from "./vk-duplicate-check";
import { computeAuthStats } from "./vk-account-auth";
import {
  countQualityCheckCompleted,
  isQualityCheckComplete,
  VK_QUALITY_CHECK_TOTAL,
} from "./vk-quality-check";

const DASHBOARD_TIMEZONE = "Europe/Moscow";
const FORECAST_WINDOW_DAYS = 7;

const GROUP_LABELS: Record<VkAccountGroup, string> = {
  kp: "КП",
  mnch: "МнЧ",
  bt: "БТ",
};

const GROUP_ORDER: VkAccountGroup[] = ["kp", "mnch", "bt"];

function getDateKey(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleDateString("en-CA", { timeZone: DASHBOARD_TIMEZONE });
}

function getDateKeyDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setTime(date.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString("en-CA", { timeZone: DASHBOARD_TIMEZONE });
}

function calcPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function countByStatus(tasks: VkTask[]): Record<VkTaskStatus, number> {
  const counts: Record<VkTaskStatus, number> = {
    new: 0,
    in_progress: 0,
    need_vk_url: 0,
    created: 0,
    ready_for_worker: 0,
    filled: 0,
    posted: 0,
    error: 0,
  };

  for (const task of tasks) {
    counts[task.status] += 1;
  }

  return counts;
}

function computeOverall(tasks: VkTask[]): VkDashboardOverall {
  const counts = countByStatus(tasks);
  const total = tasks.length;

  return {
    total,
    groupsCreated: counts.created,
    readyForWorker: counts.ready_for_worker,
    posted: counts.posted,
    error: counts.error,
    completionPercent: calcPercent(counts.posted, total),
    new: counts.new,
    in_progress: counts.in_progress,
    need_vk_url: counts.need_vk_url,
    created: counts.created,
    filled: counts.filled,
  };
}

function computeGroups(tasks: VkTask[]): VkDashboardGroupStats[] {
  return GROUP_ORDER.map((group) => {
    const groupTasks = tasks.filter((task) => task.accountGroup === group);
    const counts = countByStatus(groupTasks);
    const total = groupTasks.length;

    return {
      group,
      label: GROUP_LABELS[group],
      total,
      posted: counts.posted,
      error: counts.error,
      completionPercent: calcPercent(counts.posted, total),
    };
  });
}

function computeAccounts(tasks: VkTask[], accounts: VkAccount[]): VkDashboardAccountStats[] {
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]));
  const accountIds = new Set<string>(accountMap.keys());

  for (const task of tasks) {
    if (task.assignedAccount) {
      accountIds.add(task.assignedAccount);
    }
  }

  return Array.from(accountIds)
    .sort()
    .map((accountId) => {
      const accountTasks = tasks.filter((task) => task.assignedAccount === accountId);
      const counts = countByStatus(accountTasks);

      return {
        accountId,
        accountName: accountMap.get(accountId) ?? accountId,
        assigned: accountTasks.length,
        created: counts.created,
        filled: counts.filled,
        posted: counts.posted,
        error: counts.error,
      };
    });
}

function countTasksWithStatusOnDate(
  log: VkTaskLogEntry[],
  status: VkTaskStatus,
  dateKey: string
): number {
  const taskIds = new Set<string>();

  for (const entry of log) {
    if (entry.newStatus !== status) continue;
    if (!entry.taskId) continue;
    if (getDateKey(entry.createdAt) !== dateKey) continue;
    taskIds.add(entry.taskId);
  }

  return taskIds.size;
}

function computeToday(log: VkTaskLogEntry[]): VkDashboardToday {
  const todayKey = getDateKey();

  return {
    created: countTasksWithStatusOnDate(log, "created", todayKey),
    filled: countTasksWithStatusOnDate(log, "filled", todayKey),
    posted: countTasksWithStatusOnDate(log, "posted", todayKey),
  };
}

function countPostedOnDate(log: VkTaskLogEntry[], dateKey: string): number {
  return countTasksWithStatusOnDate(log, "posted", dateKey);
}

function computeForecast(log: VkTaskLogEntry[], overall: VkDashboardOverall): VkDashboardForecast {
  const remaining = overall.total - overall.posted;
  const dailyPosted: number[] = [];

  for (let daysAgo = FORECAST_WINDOW_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
    const dateKey = getDateKeyDaysAgo(daysAgo);
    dailyPosted.push(countPostedOnDate(log, dateKey));
  }

  const totalPostedInWindow = dailyPosted.reduce((sum, count) => sum + count, 0);
  const hasActivity = totalPostedInWindow > 0;
  const avgPostedPerDay = hasActivity ? totalPostedInWindow / FORECAST_WINDOW_DAYS : 0;
  const forecastDays =
    hasActivity && avgPostedPerDay > 0 && remaining > 0
      ? Math.ceil(remaining / avgPostedPerDay)
      : hasActivity && remaining <= 0
        ? 0
        : null;

  return {
    hasActivity,
    avgPostedPerDay: Math.round(avgPostedPerDay * 10) / 10,
    remaining,
    forecastDays,
  };
}

function computeDuplicates(tasks: VkTask[]): VkDashboardDuplicates {
  const result = findDuplicateIssues(tasks);

  return {
    exactDuplicates: result.exactCount,
    similarTexts: result.similarCount,
    cleanTasks: result.cleanTaskCount,
  };
}

function computeQuality(tasks: VkTask[]): VkDashboardQuality {
  let fullChecklist = 0;
  let fillSum = 0;

  for (const task of tasks) {
    const completed = countQualityCheckCompleted(task.qualityCheck);
    if (isQualityCheckComplete(task.qualityCheck)) {
      fullChecklist += 1;
    }
    fillSum += (completed / VK_QUALITY_CHECK_TOTAL) * 100;
  }

  const total = tasks.length;
  const partialChecklist = total - fullChecklist;

  return {
    fullChecklist,
    partialChecklist,
    avgFillPercent: total > 0 ? Math.round((fillSum / total) * 10) / 10 : 0,
  };
}

function computeAuth(accounts: VkAccount[]): VkDashboardAuthStats {
  return computeAuthStats(accounts);
}

export function computeVkDashboard(
  tasks: VkTask[],
  log: VkTaskLogEntry[],
  accounts: VkAccount[]
): VkDashboardData {
  const overall = computeOverall(tasks);

  return {
    overall,
    groups: computeGroups(tasks),
    accounts: computeAccounts(tasks, accounts),
    auth: computeAuth(accounts),
    today: computeToday(log),
    forecast: computeForecast(log, overall),
    quality: computeQuality(tasks),
    duplicates: computeDuplicates(tasks),
  };
}

export function getVkDashboardData(): VkDashboardData {
  const tasks = readVkTasksFile();
  const log = readVkTaskLogFile();
  const accounts = readVkAccountsFile();

  return computeVkDashboard(tasks, log, accounts);
}

export { VK_DASHBOARD_TRACKED_STATUSES, GROUP_LABELS };
