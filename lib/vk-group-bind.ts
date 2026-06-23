import { getVkAccountById, readVkAccountsFile } from "./vk-accounts";
import { isAccountEligibleForAssignment } from "./vk-account-auth";
import {
  buildGroupDisplayUrl,
  buildVkClubUrl,
  getGroupById,
  type VkGroupInfo,
} from "./vk-api-client";
import { appendVkTaskLogEntries, appendVkTaskLogEntry } from "./vk-task-log";
import type { VkTask } from "./vk-task-types";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "./vk-tasks";
import { statusAfterVkGroupLinked } from "./vk-task-status";
import { parseVkGroupUrl } from "./vk-url";
import { resolveVkUrl, type VkUrlResolveResult } from "./vk-url-resolve";

export interface VkGroupBindingCheckResult {
  taskId: string;
  vkGroupId: string;
  groupName: string;
  displayUrl: string;
  isAdmin: boolean;
  canPost: boolean;
  canEdit: boolean;
  error: string;
}

export interface VkGroupUrlUpdateResult {
  task: VkTask;
  resolve: VkUrlResolveResult;
  groupInfo: VkGroupInfo | null;
}

export interface VkBulkGroupUrlUpdateItem {
  taskId: string;
  vkUrl: string;
  vkGroupId: string;
  error?: string;
}

export interface VkBulkGroupUrlUpdateResult {
  accountId: string;
  linksTotal: number;
  tasksUpdated: number;
  updated: VkBulkGroupUrlUpdateItem[];
  notAssigned: string[];
  notRecognized: Array<{ vkUrl: string; error: string }>;
  errors: string[];
}

function getAccessTokenForAccount(accountId: string): string {
  const account = getVkAccountById(accountId, readVkAccountsFile());
  if (!account) {
    throw new Error(`Аккаунт "${accountId}" не найден`);
  }
  if (!isAccountEligibleForAssignment(account)) {
    throw new Error(`Аккаунт "${accountId}" не подключён или не active`);
  }
  const token = account.accessToken.trim();
  if (!token) {
    throw new Error(`У аккаунта "${accountId}" нет accessToken`);
  }
  return token;
}

function sortBindingTasks(a: VkTask, b: VkTask): number {
  const aTime = a.assignedAt || a.updatedAt || a.createdAt;
  const bTime = b.assignedAt || b.updatedAt || b.createdAt;
  const byTime = aTime.localeCompare(bTime);
  if (byTime !== 0) return byTime;
  return a.id.localeCompare(b.id);
}

export function getGroupBindingTasks(tasks: VkTask[], accountId?: string): VkTask[] {
  return tasks
    .filter((task) => {
      if (accountId && task.assignedAccount.trim() !== accountId) return false;
      return task.assignedAccount.trim().length > 0;
    })
    .sort(sortBindingTasks);
}

function normalizeUrlLines(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parsed = parseVkGroupUrl(trimmed);
    const vkUrl = parsed.vkUrl || trimmed;
    const key = vkUrl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(vkUrl);
  }

  return result;
}

async function resolveDisplayUrl(
  accessToken: string | undefined,
  vkGroupId: string,
  fallbackUrl: string
): Promise<string> {
  if (!accessToken || !vkGroupId.trim()) {
    return fallbackUrl || buildVkClubUrl(vkGroupId);
  }

  const groupId = Number(vkGroupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    return fallbackUrl || buildVkClubUrl(vkGroupId);
  }

  try {
    const info = await getGroupById(accessToken, groupId);
    if (info?.displayUrl) {
      return info.displayUrl;
    }
  } catch {
    // keep fallback
  }

  return fallbackUrl || buildVkClubUrl(vkGroupId);
}

async function applyResolvedGroupToTask(input: {
  tasks: VkTask[];
  existing: VkTask;
  resolve: VkUrlResolveResult;
  accessToken?: string;
  manualCreated?: boolean;
  lastBindBatchId?: string;
}): Promise<{ task: VkTask; displayUrl: string; groupInfo: VkGroupInfo | null }> {
  const accounts = readVkAccountsFile();
  const displayUrl = await resolveDisplayUrl(
    input.accessToken,
    input.resolve.vkGroupId,
    input.resolve.vkUrl
  );

  let groupInfo: VkGroupInfo | null = null;
  if (input.accessToken && input.resolve.vkGroupId) {
    const groupId = Number(input.resolve.vkGroupId);
    if (Number.isFinite(groupId) && groupId > 0) {
      try {
        groupInfo = await getGroupById(input.accessToken, groupId);
      } catch {
        groupInfo = null;
      }
    }
  }

  const merged = {
    vkGroupId: input.resolve.vkGroupId,
    vkUrl: groupInfo?.displayUrl || displayUrl,
    assignedAccount: input.existing.assignedAccount,
  };

  const updated = updateVkTask(input.tasks, input.existing.id, {
    ...merged,
    manualCreated: input.manualCreated ?? true,
    lastBindBatchId: input.lastBindBatchId ?? input.existing.lastBindBatchId,
    status: statusAfterVkGroupLinked(merged, accounts),
  });

  if (!updated) {
    throw new Error("Не удалось обновить задачу");
  }

  return {
    task: updated,
    displayUrl: merged.vkUrl,
    groupInfo,
  };
}

export async function updateTaskGroupFromUrl(input: {
  taskId: string;
  urlInput: string;
  accountId?: string;
  save?: boolean;
}): Promise<VkGroupUrlUpdateResult> {
  const taskId = input.taskId.trim();
  const urlInput = input.urlInput.trim();

  if (!taskId) throw new Error("taskId обязателен");
  if (!urlInput) throw new Error("Ссылка обязательна");

  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === taskId);
  if (!existing) throw new Error("Задача не найдена");

  const accountId = (input.accountId ?? existing.assignedAccount).trim();
  let accessToken: string | undefined;

  if (accountId) {
    try {
      accessToken = getAccessTokenForAccount(accountId);
    } catch {
      accessToken = undefined;
    }
  }

  const resolve = await resolveVkUrl(urlInput, accessToken);
  if (!resolve.resolved || !resolve.vkGroupId) {
    throw new Error(resolve.error || "Не удалось распознать vkGroupId");
  }

  const applied = await applyResolvedGroupToTask({
    tasks,
    existing,
    resolve,
    accessToken,
    manualCreated: true,
  });

  if (input.save !== false) {
    writeVkTasksFile(tasks);
    appendVkTaskLogEntry({
      taskId,
      action: "updated",
      oldStatus: existing.status,
      newStatus: applied.task.status,
      assignedAccount: applied.task.assignedAccount,
      vkUrl: applied.task.vkUrl,
      vkGroupId: applied.task.vkGroupId,
      message: `Группа привязана по vkGroupId ${applied.task.vkGroupId}`,
    });
  }

  return {
    task: applied.task,
    resolve,
    groupInfo: applied.groupInfo,
  };
}

export async function bulkUpdateTaskGroupUrls(input: {
  accountId: string;
  urls: string[];
  save?: boolean;
}): Promise<VkBulkGroupUrlUpdateResult> {
  const accountId = input.accountId.trim();
  if (!accountId) throw new Error("accountId обязателен");

  const accessToken = getAccessTokenForAccount(accountId);
  const urlList = normalizeUrlLines(input.urls.join("\n"));
  const tasks = readVkTasksFile();
  const candidates = getGroupBindingTasks(tasks, accountId).filter(
    (task) => task.status !== "posted"
  );

  const result: VkBulkGroupUrlUpdateResult = {
    accountId,
    linksTotal: urlList.length,
    tasksUpdated: 0,
    updated: [],
    notAssigned: [],
    notRecognized: [],
    errors: [],
  };

  if (urlList.length === 0) {
    result.errors.push("Нет ссылок для обновления");
    return result;
  }

  if (candidates.length === 0) {
    result.errors.push(`Нет задач с назначенным аккаунтом ${accountId}`);
    result.notAssigned.push(...urlList);
    return result;
  }

  const logEntries: Parameters<typeof appendVkTaskLogEntries>[0] = [];
  let candidateIndex = 0;

  for (const urlInput of urlList) {
    if (candidateIndex >= candidates.length) {
      result.notAssigned.push(urlInput);
      continue;
    }

    const existing = candidates[candidateIndex];
    candidateIndex += 1;

    const resolve = await resolveVkUrl(urlInput, accessToken);
    if (!resolve.resolved || !resolve.vkGroupId) {
      result.notRecognized.push({
        vkUrl: urlInput,
        error: resolve.error || "Не удалось распознать vkGroupId",
      });
      continue;
    }

    try {
      const applied = await applyResolvedGroupToTask({
        tasks,
        existing,
        resolve,
        accessToken,
        manualCreated: true,
      });

      result.updated.push({
        taskId: applied.task.id,
        vkUrl: applied.task.vkUrl,
        vkGroupId: applied.task.vkGroupId,
      });
      result.tasksUpdated += 1;

      logEntries.push({
        taskId: applied.task.id,
        action: "updated",
        oldStatus: existing.status,
        newStatus: applied.task.status,
        assignedAccount: applied.task.assignedAccount,
        vkUrl: applied.task.vkUrl,
        vkGroupId: applied.task.vkGroupId,
        message: `Массовое обновление ссылки → vkGroupId ${applied.task.vkGroupId}`,
      });
    } catch (error) {
      result.notRecognized.push({
        vkUrl: urlInput,
        error: error instanceof Error ? error.message : "Ошибка обновления задачи",
      });
    }
  }

  if (input.save !== false && result.tasksUpdated > 0) {
    writeVkTasksFile(tasks);
    appendVkTaskLogEntries(logEntries);
  }

  return result;
}

export async function checkTaskGroupBinding(input: {
  taskId: string;
  accountId?: string;
}): Promise<VkGroupBindingCheckResult> {
  const taskId = input.taskId.trim();
  if (!taskId) throw new Error("taskId обязателен");

  const tasks = readVkTasksFile();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("Задача не найдена");

  const vkGroupId = task.vkGroupId.trim();
  if (!vkGroupId) {
    return {
      taskId,
      vkGroupId: "",
      groupName: "",
      displayUrl: task.vkUrl,
      isAdmin: false,
      canPost: false,
      canEdit: false,
      error: "vkGroupId не заполнен",
    };
  }

  const accountId = (input.accountId ?? task.assignedAccount).trim();
  if (!accountId) {
    return {
      taskId,
      vkGroupId,
      groupName: "",
      displayUrl: task.vkUrl || buildVkClubUrl(vkGroupId),
      isAdmin: false,
      canPost: false,
      canEdit: false,
      error: "assignedAccount не заполнен",
    };
  }

  const accessToken = getAccessTokenForAccount(accountId);
  const groupId = Number(vkGroupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    return {
      taskId,
      vkGroupId,
      groupName: "",
      displayUrl: task.vkUrl,
      isAdmin: false,
      canPost: false,
      canEdit: false,
      error: "vkGroupId должен быть положительным числом",
    };
  }

  const info = await getGroupById(accessToken, groupId);
  if (!info) {
    return {
      taskId,
      vkGroupId,
      groupName: "",
      displayUrl: task.vkUrl || buildVkClubUrl(vkGroupId),
      isAdmin: false,
      canPost: false,
      canEdit: false,
      error: "groups.getById не вернул данные",
    };
  }

  if (info.displayUrl && info.displayUrl !== task.vkUrl) {
    const tasks = readVkTasksFile();
    const updated = updateVkTask(tasks, taskId, { vkUrl: info.displayUrl });
    if (updated) {
      writeVkTasksFile(tasks);
    }
  }

  return {
    taskId,
    vkGroupId,
    groupName: info.name,
    displayUrl: info.displayUrl,
    isAdmin: info.isAdmin,
    canPost: info.canPost,
    canEdit: info.canEdit,
    error: "",
  };
}
