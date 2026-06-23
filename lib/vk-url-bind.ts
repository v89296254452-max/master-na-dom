import { getVkAccountById, readVkAccountsFile } from "./vk-accounts";
import { isAccountEligibleForAssignment } from "./vk-account-auth";
import { appendVkTaskLogEntries } from "./vk-task-log";
import type { VkTask } from "./vk-task-types";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "./vk-tasks";
import {
  addVkUnparsedUrls,
  readVkUnparsedUrlsFile,
  removeVkUnparsedUrlsByIds,
  type VkUnparsedUrl,
} from "./vk-unparsed-urls";
import { parseVkGroupUrl } from "./vk-url";
import { resolveVkUrl } from "./vk-url-resolve";
import { appendVkUrlBindBatch, createBindBatchId } from "./vk-url-bind-batches";
import type { VkUrlBindBatch } from "./vk-url-bind-batches";
import { statusAfterVkGroupLinked } from "./vk-task-status";
import { buildGroupDisplayUrl, buildVkClubUrl, getGroupById } from "./vk-api-client";

export type VkUrlBindMode = "need_vk_url" | "auto";

export interface VkUrlBindAssignment {
  taskId: string;
  vkUrl: string;
  vkGroupId: string;
  unparsedId?: string;
}

export interface VkUrlBindNotRecognized {
  vkUrl: string;
  error: string;
}

export interface VkUrlBindResult {
  mode: VkUrlBindMode;
  linksTotal: number;
  tasksUpdated: number;
  bound: VkUrlBindAssignment[];
  notAssigned: string[];
  notRecognized: VkUrlBindNotRecognized[];
  errors: string[];
  /** @deprecated use notAssigned */
  skipped: string[];
  remainingUnparsed: number;
  remainingCandidates: number;
  batchId?: string;
  batch?: VkUrlBindBatch;
  updatedTaskIds?: string[];
}

function getAccessToken(accountId: string): string {
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

function sortBindCandidates(a: VkTask, b: VkTask): number {
  const aTime = a.assignedAt || a.updatedAt || a.createdAt;
  const bTime = b.assignedAt || b.updatedAt || b.createdAt;
  const byTime = aTime.localeCompare(bTime);
  if (byTime !== 0) return byTime;
  return a.id.localeCompare(b.id);
}

function isTaskWithoutVkLink(task: Pick<VkTask, "vkGroupId">): boolean {
  return !task.vkGroupId.trim();
}

export function getTasksNeedingVkUrl(tasks: VkTask[], accountId: string): VkTask[] {
  return tasks
    .filter(
      (task) =>
        task.status === "need_vk_url" &&
        task.assignedAccount.trim() === accountId &&
        isTaskWithoutVkLink(task)
    )
    .sort(sortBindCandidates);
}

export function getAutoBindCandidates(tasks: VkTask[], accountId: string): VkTask[] {
  return tasks
    .filter(
      (task) =>
        (task.status === "in_progress" || task.status === "created") &&
        task.assignedAccount.trim() === accountId &&
        isTaskWithoutVkLink(task)
    )
    .sort(sortBindCandidates);
}

function getBindCandidates(tasks: VkTask[], accountId: string, mode: VkUrlBindMode): VkTask[] {
  return mode === "auto" ? getAutoBindCandidates(tasks, accountId) : getTasksNeedingVkUrl(tasks, accountId);
}

function normalizeUrlList(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of urls) {
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

async function bindUrlToTask(
  tasks: VkTask[],
  task: VkTask,
  vkUrl: string,
  accessToken: string,
  batchId: string
): Promise<{ task: VkTask; vkGroupId: string; error?: string }> {
  const resolve = await resolveVkUrl(vkUrl, accessToken);

  if (!resolve.resolved || !resolve.vkGroupId) {
    return {
      task,
      vkGroupId: "",
      error: resolve.error || "Не удалось распознать vkGroupId",
    };
  }

  const accounts = readVkAccountsFile();
  let displayUrl = resolve.vkUrl;

  const groupId = Number(resolve.vkGroupId);
  if (Number.isFinite(groupId) && groupId > 0) {
    try {
      const info = await getGroupById(accessToken, groupId);
      if (info?.displayUrl) {
        displayUrl = info.displayUrl;
      } else {
        displayUrl = buildGroupDisplayUrl(groupId, resolve.screenName) || buildVkClubUrl(groupId);
      }
    } catch {
      displayUrl = buildGroupDisplayUrl(resolve.vkGroupId, resolve.screenName) || buildVkClubUrl(resolve.vkGroupId);
    }
  }

  const merged = {
    vkUrl: displayUrl,
    vkGroupId: resolve.vkGroupId,
    assignedAccount: task.assignedAccount,
  };

  const updated = updateVkTask(tasks, task.id, {
    ...merged,
    manualCreated: true,
    lastBindBatchId: batchId,
    status: statusAfterVkGroupLinked(merged, accounts),
  });

  if (!updated) {
    return { task, vkGroupId: "", error: "Не удалось обновить задачу" };
  }

  return { task: updated, vkGroupId: resolve.vkGroupId };
}

export async function bindVkUrlsToAccountTasks(input: {
  accountId: string;
  urls: string[];
  useUnparsedQueue?: boolean;
  mode?: VkUrlBindMode;
}): Promise<VkUrlBindResult> {
  const accountId = input.accountId.trim();
  const mode: VkUrlBindMode = input.mode === "auto" ? "auto" : "need_vk_url";

  if (!accountId) {
    throw new Error("accountId обязателен");
  }

  const accessToken = getAccessToken(accountId);
  const tasks = readVkTasksFile();
  const candidates = getBindCandidates(tasks, accountId, mode);
  const batchId = createBindBatchId();

  let urlSources: Array<{ vkUrl: string; unparsedId?: string }> = normalizeUrlList(input.urls).map(
    (vkUrl) => ({ vkUrl })
  );

  const removedUnparsedIds: string[] = [];

  if (input.useUnparsedQueue) {
    const unparsed = readVkUnparsedUrlsFile();
    for (const item of unparsed) {
      urlSources.push({ vkUrl: item.vkUrl, unparsedId: item.id });
    }
  }

  const seenUrls = new Set<string>();
  urlSources = urlSources.filter((item) => {
    const key = item.vkUrl.toLowerCase();
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });

  const linksTotal = urlSources.length;

  const result: VkUrlBindResult = {
    mode,
    linksTotal,
    tasksUpdated: 0,
    bound: [],
    notAssigned: [],
    notRecognized: [],
    errors: [],
    skipped: [],
    remainingUnparsed: readVkUnparsedUrlsFile().length,
    remainingCandidates: candidates.length,
  };

  if (urlSources.length === 0) {
    result.errors.push("Нет ссылок для привязки");
    return result;
  }

  if (candidates.length === 0) {
    const statusLabel = mode === "auto" ? "in_progress/created" : "need_vk_url";
    result.errors.push(`Нет свободных задач (${statusLabel}) для аккаунта ${accountId}`);
    result.notAssigned.push(...urlSources.map((item) => item.vkUrl));
    result.skipped = [...result.notAssigned];
    return result;
  }

  const logEntries: Parameters<typeof appendVkTaskLogEntries>[0] = [];
  let candidateIndex = 0;

  for (const source of urlSources) {
    if (candidateIndex >= candidates.length) {
      result.notAssigned.push(source.vkUrl);
      continue;
    }

    const task = candidates[candidateIndex];
    const bind = await bindUrlToTask(tasks, task, source.vkUrl, accessToken, batchId);

    if (bind.error || !bind.vkGroupId) {
      result.notRecognized.push({
        vkUrl: source.vkUrl,
        error: bind.error ?? "Не удалось распознать vkGroupId",
      });
      continue;
    }

    result.bound.push({
      taskId: bind.task.id,
      vkUrl: bind.task.vkUrl,
      vkGroupId: bind.vkGroupId,
      unparsedId: source.unparsedId,
    });
    result.tasksUpdated += 1;

    if (source.unparsedId) {
      removedUnparsedIds.push(source.unparsedId);
    }

    logEntries.push({
      taskId: bind.task.id,
      action: "updated",
      oldStatus: task.status,
      newStatus: bind.task.status,
      assignedAccount: bind.task.assignedAccount,
      vkUrl: bind.task.vkUrl,
      vkGroupId: bind.task.vkGroupId,
      message:
        mode === "auto"
          ? `Автопривязка [${batchId}]: ${bind.task.vkUrl} → vkGroupId ${bind.vkGroupId}`
          : `VK URL привязан [${batchId}]: ${bind.task.vkUrl}`,
    });

    candidateIndex += 1;
  }

  result.skipped = [...result.notAssigned];

  writeVkTasksFile(tasks);

  if (removedUnparsedIds.length > 0) {
    removeVkUnparsedUrlsByIds(removedUnparsedIds);
  }

  if (logEntries.length > 0) {
    appendVkTaskLogEntries(logEntries);
  }

  if (result.tasksUpdated > 0) {
    const batch: VkUrlBindBatch = {
      batchId,
      createdAt: new Date().toISOString(),
      accountId,
      mode,
      linksTotal: result.linksTotal,
      tasksUpdated: result.tasksUpdated,
      taskIds: result.bound.map((item) => item.taskId),
    };

    appendVkUrlBindBatch(batch);
    result.batchId = batchId;
    result.batch = batch;
    result.updatedTaskIds = batch.taskIds;
  }

  result.remainingUnparsed = readVkUnparsedUrlsFile().length;
  result.remainingCandidates = getBindCandidates(readVkTasksFile(), accountId, mode).length;

  return result;
}

export function importUnparsedUrlsFromLines(lines: string[]): VkUnparsedUrl[] {
  const urls = normalizeUrlList(lines);
  if (urls.length === 0) return [];
  return addVkUnparsedUrls(urls, "bulk_import");
}

export function parseAutoBindUrlLines(text: string): string[] {
  return normalizeUrlList(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
  );
}
