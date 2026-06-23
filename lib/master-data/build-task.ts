import fs from "fs";
import path from "path";
import { createJob, listGroups } from "@/lib/vk-automation/db";
import { dedupeKeyCityService } from "@/lib/vk-automation/import-normalize";
import { getPhone } from "@/lib/pages";
import { readVkTasksFile } from "@/lib/vk-tasks";
import type { VkTask } from "@/lib/vk-task-types";
import type { VkAccountGroup } from "@/lib/vk-types";
import {
  getBrowserAccountMergeError,
  getMasterAccounts,
  resolveBrowserAccount,
} from "./accounts";
import { getLandingPageBySlug } from "./landing-pages";
import { getVkTextsFromTask } from "./texts";
import type { BuildTasksResult, MasterDataSource, VkGroupCreationTask } from "./types";
import { getMasterDataSource } from "./source";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

function resolvePublicPath(relativePath: string): string | undefined {
  if (!relativePath?.trim()) return undefined;
  const normalized = relativePath.replace(/^\/+/, "");
  const full = path.join(PUBLIC_ROOT, normalized);
  return fs.existsSync(full) ? full : undefined;
}

export function taskOfferKey(city: string, service: string, offerGroup: string): string {
  return dedupeKeyCityService(city, service).replace("task:", `offer:${offerGroup}:`);
}

export function isGroupAlreadyCreated(task: VkTask): boolean {
  if (task.vkUrl?.trim() || task.vkGroupId?.trim()) return true;
  return task.status === "created" || task.status === "filled" || task.status === "posted";
}

export function isOfferCombinationTaken(city: string, service: string, offerGroup: string): boolean {
  const key = taskOfferKey(city, service, offerGroup);

  for (const vkTask of readVkTasksFile()) {
    if (
      isGroupAlreadyCreated(vkTask) &&
      taskOfferKey(vkTask.city, vkTask.service, vkTask.accountGroup) === key
    ) {
      return true;
    }
  }

  for (const g of listGroups(5000)) {
    if (g.vkUrl && g.city.toLowerCase() === city.toLowerCase()) {
      const gKey = taskOfferKey(g.city, service, offerGroup);
      if (gKey === key) return true;
    }
  }

  return false;
}

export type BuildVkGroupTaskResult =
  | { ok: true; task: VkGroupCreationTask }
  | { ok: false; error: string };

export function buildVkGroupTask(
  vkTaskId: string,
  accountId: string,
  source?: MasterDataSource
): BuildVkGroupTaskResult {
  const mode = source ?? getMasterDataSource();
  const task = readVkTasksFile().find((t) => t.id === vkTaskId);
  if (!task) {
    return { ok: false, error: `Задача ${vkTaskId} не найдена` };
  }

  if (mode === "legacy") {
    const legacyAccount = getMasterAccounts("legacy").find((a) => a.id === accountId);
    if (!legacyAccount) {
      return { ok: false, error: `Browser account ${accountId} не найден` };
    }

    const landing = getLandingPageBySlug(task.slug);
    const texts = getVkTextsFromTask(task);
    const posts: VkGroupCreationTask["posts"] = [];

    if (texts.pinnedPost) {
      posts.push({
        text: texts.pinnedPost,
        imagePath: resolvePublicPath(task.imageAssets?.postImagePaths?.[0] ?? ""),
      });
    }
    for (let i = 0; i < texts.posts.length; i += 1) {
      posts.push({
        text: texts.posts[i],
        imagePath: resolvePublicPath(task.imageAssets?.postImagePaths?.[i + 1] ?? ""),
      });
    }

    return {
      ok: true,
      task: {
        taskId: task.id,
        accountId: legacyAccount.id,
        browserAccountId: legacyAccount.id,
        proxy: legacyAccount.proxy || undefined,
        city: task.city,
        service: task.service,
        offerGroup: task.accountGroup,
        groupTitle: task.vkName,
        groupDescription: task.vkDescription,
        phone: getPhone(task.phone),
        landingUrl: landing?.url || task.siteUrl,
        posts,
        avatarPath: resolvePublicPath(task.imageAssets?.avatarPath ?? ""),
        coverPath: resolvePublicPath(task.imageAssets?.coverPath ?? ""),
      },
    };
  }

  const resolved = resolveBrowserAccount(accountId);
  if (!resolved) {
    return { ok: false, error: getBrowserAccountMergeError(accountId) };
  }

  const landing = getLandingPageBySlug(task.slug);
  const texts = getVkTextsFromTask(task);
  const posts: VkGroupCreationTask["posts"] = [];

  if (texts.pinnedPost) {
    posts.push({
      text: texts.pinnedPost,
      imagePath: resolvePublicPath(task.imageAssets?.postImagePaths?.[0] ?? ""),
    });
  }
  for (let i = 0; i < texts.posts.length; i += 1) {
    posts.push({
      text: texts.posts[i],
      imagePath: resolvePublicPath(task.imageAssets?.postImagePaths?.[i + 1] ?? ""),
    });
  }

  return {
    ok: true,
    task: {
      taskId: task.id,
      accountId: resolved.apiAccountId,
      browserAccountId: resolved.browserAccountId,
      proxy: resolved.proxy || undefined,
      city: task.city,
      service: task.service,
      offerGroup: task.accountGroup,
      groupTitle: task.vkName,
      groupDescription: task.vkDescription,
      phone: getPhone(task.phone),
      landingUrl: landing?.url || task.siteUrl,
      posts,
      avatarPath: resolvePublicPath(task.imageAssets?.avatarPath ?? ""),
      coverPath: resolvePublicPath(task.imageAssets?.coverPath ?? ""),
    },
  };
}

export interface BuildGroupTasksOptions {
  accountId?: string;
  offerGroup?: VkAccountGroup | "all";
  limit?: number;
  source?: MasterDataSource;
  onlyWithoutGroup?: boolean;
}

export function buildAndEnqueueGroupTasks(options: BuildGroupTasksOptions = {}): BuildTasksResult {
  const source = options.source ?? getMasterDataSource();
  const limit = options.limit ?? 50;
  const result: BuildTasksResult = { created: 0, skipped: 0, errors: [], jobIds: [] };

  let tasks = readVkTasksFile();
  if (options.onlyWithoutGroup !== false) {
    tasks = tasks.filter((t) => !isGroupAlreadyCreated(t));
  }
  if (options.offerGroup && options.offerGroup !== "all") {
    tasks = tasks.filter((t) => t.accountGroup === options.offerGroup);
  }

  const accounts = options.accountId
    ? getMasterAccounts(source).filter((a) => a.id === options.accountId)
    : getMasterAccounts(source).filter((a) => {
        if (a.status !== "active") return false;
        if (source === "project") return Boolean(resolveBrowserAccount(a.id));
        return true;
      });

  if (accounts.length === 0) {
    result.errors.push(options.accountId
      ? getBrowserAccountMergeError(options.accountId)
      : "Нет активных аккаунтов");
    return result;
  }

  let accountIndex = 0;

  for (const task of tasks) {
    if (result.created >= limit) break;

    if (isOfferCombinationTaken(task.city, task.service, task.accountGroup)) {
      result.skipped += 1;
      continue;
    }

    const account = options.accountId ? accounts[0] : accounts[accountIndex % accounts.length];
    if (!account) break;

    if (account.offerGroups.length > 0 && !account.offerGroups.includes(task.accountGroup)) {
      result.skipped += 1;
      continue;
    }

    const built = buildVkGroupTask(task.id, account.id, source);
    if (!built.ok) {
      result.errors.push(built.error);
      continue;
    }

    const job = createJob({
      accountId: built.task.accountId,
      action: "create_group_full",
      payload: { masterTask: built.task },
    });
    result.jobIds.push(job.id);
    result.created += 1;
    accountIndex += 1;
  }

  return result;
}
