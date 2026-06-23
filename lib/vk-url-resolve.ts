import { getVkAccountById, readVkAccountsFile } from "./vk-accounts";
import { isAccountEligibleForAssignment } from "./vk-account-auth";
import { resolveScreenName, buildGroupDisplayUrl, buildVkClubUrl, getGroupById, type VkResolveScreenNameResult } from "./vk-api-client";
import type { VkTask } from "./vk-task-types";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "./vk-tasks";
import { appendVkTaskLogEntry } from "./vk-task-log";
import { statusAfterVkGroupLinked, taskHasGroupInfo } from "./vk-task-status";
import { parseVkGroupUrl, type ParsedVkGroupUrl, type VkGroupUrlType } from "./vk-url";

export interface VkUrlResolveResult {
  vkUrl: string;
  vkGroupId: string;
  screenName: string;
  type: VkGroupUrlType;
  resolved: boolean;
  parsed: ParsedVkGroupUrl;
  resolveScreenNameResponse: VkResolveScreenNameResult | null;
  error: string;
}

export async function resolveVkUrl(
  vkUrl: string,
  accessToken?: string
): Promise<VkUrlResolveResult> {
  const parsed = parseVkGroupUrl(vkUrl);

  if (parsed.vkGroupId) {
    return {
      vkUrl: parsed.vkUrl,
      vkGroupId: parsed.vkGroupId,
      screenName: parsed.screenName,
      type: parsed.type,
      resolved: true,
      parsed,
      resolveScreenNameResponse: null,
      error: "",
    };
  }

  if (parsed.type === "screen_name" && parsed.screenName) {
    const token = accessToken?.trim() ?? "";
    if (!token) {
      return {
        vkUrl: parsed.vkUrl,
        vkGroupId: "",
        screenName: parsed.screenName,
        type: parsed.type,
        resolved: false,
        parsed,
        resolveScreenNameResponse: null,
        error: "Для screen_name нужен accessToken аккаунта",
      };
    }

    try {
      const apiResult = await resolveScreenName(token, parsed.screenName);
      if (!apiResult) {
        return {
          vkUrl: parsed.vkUrl,
          vkGroupId: "",
          screenName: parsed.screenName,
          type: parsed.type,
          resolved: false,
          parsed,
          resolveScreenNameResponse: null,
          error: "utils.resolveScreenName не вернул object_id",
        };
      }

      return {
        vkUrl: parsed.vkUrl,
        vkGroupId: String(apiResult.objectId),
        screenName: parsed.screenName,
        type: parsed.type,
        resolved: true,
        parsed,
        resolveScreenNameResponse: apiResult,
        error: "",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка utils.resolveScreenName";
      return {
        vkUrl: parsed.vkUrl,
        vkGroupId: "",
        screenName: parsed.screenName,
        type: parsed.type,
        resolved: false,
        parsed,
        resolveScreenNameResponse: null,
        error: message,
      };
    }
  }

  return {
    vkUrl: parsed.vkUrl,
    vkGroupId: "",
    screenName: parsed.screenName,
    type: parsed.type,
    resolved: false,
    parsed,
    resolveScreenNameResponse: null,
    error: parsed.vkUrl ? "Не удалось распознать vkGroupId из ссылки" : "Пустая ссылка VK",
  };
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

export async function resolveAndUpdateVkTask(input: {
  taskId: string;
  vkUrl: string;
  accountId?: string;
  save?: boolean;
}): Promise<{ task: VkTask; resolve: VkUrlResolveResult }> {
  const taskId = input.taskId.trim();
  const vkUrl = input.vkUrl.trim();

  if (!taskId) {
    throw new Error("taskId обязателен");
  }
  if (!vkUrl) {
    throw new Error("vkUrl обязателен");
  }

  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === taskId);
  if (!existing) {
    throw new Error("Задача не найдена");
  }

  const accountId = (input.accountId ?? existing.assignedAccount).trim();
  let accessToken: string | undefined;

  if (accountId) {
    try {
      accessToken = getAccessTokenForAccount(accountId);
    } catch {
      accessToken = undefined;
    }
  }

  const resolve = await resolveVkUrl(vkUrl, accessToken);

  if (!resolve.resolved) {
    const accounts = readVkAccountsFile();
    const merged = {
      vkUrl: resolve.vkUrl || vkUrl,
      vkGroupId: existing.vkGroupId,
      assignedAccount: accountId && !existing.assignedAccount.trim() ? accountId : existing.assignedAccount,
    };

    if (merged.vkUrl.trim() && input.save !== false) {
      const updated = updateVkTask(tasks, taskId, {
        vkUrl: merged.vkUrl,
        status: taskHasGroupInfo(merged) ? "created" : existing.status,
      });

      if (updated) {
        writeVkTasksFile(tasks);
        appendVkTaskLogEntry({
          taskId,
          action: "updated",
          oldStatus: existing.status,
          newStatus: updated.status,
          assignedAccount: updated.assignedAccount,
          vkUrl: updated.vkUrl,
          vkGroupId: updated.vkGroupId,
          message: resolve.error || "need_manual_check: не удалось распознать vkGroupId",
        });
        return { task: updated, resolve };
      }
    }

    return { task: existing, resolve };
  }

  const accounts = readVkAccountsFile();
  const merged = {
    vkGroupId: resolve.vkGroupId,
    vkUrl: resolve.vkUrl,
    assignedAccount: accountId && !existing.assignedAccount.trim() ? accountId : existing.assignedAccount,
  };

  if (accessToken && resolve.vkGroupId) {
    const groupId = Number(resolve.vkGroupId);
    if (Number.isFinite(groupId) && groupId > 0) {
      try {
        const info = await getGroupById(accessToken, groupId);
        if (info?.displayUrl) {
          merged.vkUrl = info.displayUrl;
        } else {
          merged.vkUrl = buildGroupDisplayUrl(groupId, resolve.screenName) || buildVkClubUrl(groupId);
        }
      } catch {
        merged.vkUrl = buildGroupDisplayUrl(resolve.vkGroupId, resolve.screenName) || buildVkClubUrl(resolve.vkGroupId);
      }
    }
  } else if (resolve.vkGroupId) {
    merged.vkUrl = buildGroupDisplayUrl(resolve.vkGroupId, resolve.screenName) || buildVkClubUrl(resolve.vkGroupId);
  }

  const updated = updateVkTask(tasks, taskId, {
    ...merged,
    manualCreated: true,
    status: statusAfterVkGroupLinked(merged, accounts),
  });

  if (!updated) {
    throw new Error("Не удалось обновить задачу");
  }

  if (input.save !== false) {
    writeVkTasksFile(tasks);
    appendVkTaskLogEntry({
      taskId,
      action: "updated",
      oldStatus: existing.status,
      newStatus: updated.status,
      assignedAccount: updated.assignedAccount,
      vkUrl: updated.vkUrl,
      vkGroupId: updated.vkGroupId,
      message: `VK URL распознан: ${resolve.vkGroupId}`,
    });
  }

  return { task: updated, resolve };
}

export async function ensureTaskVkGroupIdResolved(
  task: VkTask,
  accountId: string
): Promise<{ task: VkTask; resolve: VkUrlResolveResult | null }> {
  if (task.vkGroupId.trim()) {
    return { task, resolve: null };
  }

  if (!task.vkUrl.trim()) {
    throw new Error("vkGroupId is missing");
  }

  const result = await resolveAndUpdateVkTask({
    taskId: task.id,
    vkUrl: task.vkUrl,
    accountId,
    save: true,
  });

  if (!result.resolve.resolved || !result.task.vkGroupId.trim()) {
    throw new Error(result.resolve.error || "Не удалось определить vkGroupId");
  }

  return result;
}
