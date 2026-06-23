import type { BrowserContextOptions } from "playwright";
import { getBrowserAccountMergeError, getVkApiAccounts, resolveBrowserAccount } from "@/lib/master-data/accounts";
import { getMasterDataSource } from "@/lib/master-data/source";
import { VK_AUTOMATION_CONFIG } from "./config";
import {
  createJob,
  getAccountById,
  listAccounts,
  listJobs,
  computeQueueStats,
  completeJob,
  claimNextJob,
} from "./db";
import type { VkBrowserJob, VkBrowserJobAction, VkBrowserQueueStats } from "./types";

function assertAccountForEnqueue(accountId: string): void {
  const source = getMasterDataSource();
  if (source === "project") {
    if (!resolveBrowserAccount(accountId)) {
      throw new Error(getBrowserAccountMergeError(accountId));
    }
    return;
  }

  const account = getAccountById(accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }
}

export function enqueueJob(input: {
  accountId: string;
  action: VkBrowserJobAction;
  taskId?: number | null;
  payload?: Record<string, unknown>;
}): VkBrowserJob {
  assertAccountForEnqueue(input.accountId);
  return createJob(input);
}

export function enqueueAuthOpen(accountId: string): VkBrowserJob {
  return enqueueJob({ accountId, action: "auth_open" });
}

export function enqueueAuthCheck(accountId: string): VkBrowserJob {
  return enqueueJob({ accountId, action: "auth_check" });
}

export function enqueueCreateTestGroup(accountId: string): VkBrowserJob {
  return enqueueJob({ accountId, action: "create_test_group" });
}

export function enqueueCreateGroupForTask(taskId: number, accountId: string): VkBrowserJob {
  return enqueueJob({ accountId, action: "create_group", taskId });
}

export function enqueueBatchCreateGroups(accountIds: string[], limit = 10): VkBrowserJob[] {
  const jobs: VkBrowserJob[] = [];
  const source = getMasterDataSource();

  let ids = accountIds;
  if (source === "project") {
    const apiAccounts = getVkApiAccounts()
      .filter((a) => a.status === "active" && resolveBrowserAccount(a.id))
      .map((a) => a.id);
    ids = accountIds.length > 0
      ? accountIds.filter((id) => resolveBrowserAccount(id))
      : apiAccounts;
  } else {
    ids = listAccounts()
      .filter((a) => accountIds.includes(a.id) && a.status === "active")
      .map((a) => a.id);
  }

  const slice = ids.slice(0, limit);

  for (const accountId of slice) {
    jobs.push(enqueueCreateTestGroup(accountId));
  }

  return jobs;
}

export function getQueueOverview(): {
  stats: VkBrowserQueueStats;
  recentJobs: VkBrowserJob[];
} {
  return {
    stats: computeQueueStats(),
    recentJobs: listJobs(50),
  };
}

export function claimJob(): VkBrowserJob | null {
  return claimNextJob();
}

export function finishJob(
  jobId: string,
  status: "success" | "failed" | "skipped",
  result?: Record<string, unknown>,
  error?: string,
  retry?: boolean
): VkBrowserJob | null {
  return completeJob(jobId, status, result ?? {}, error ?? "", retry ?? false);
}

export function isTransientError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("net::") ||
    lower.includes("navigation") ||
    lower.includes("target closed") ||
    lower.includes("temporarily") ||
    lower.includes("ошибка сети")
  );
}

export function getBrowserLaunchOptions(): { headless: boolean } {
  return { headless: VK_AUTOMATION_CONFIG.browserHeadless };
}

export function buildContextOptions(accountProxy: string): BrowserContextOptions {
  const options: BrowserContextOptions = {
    locale: "ru-RU",
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  const proxy = parseProxyString(accountProxy);
  if (proxy) {
    options.proxy = proxy;
  }

  return options;
}

export function parseProxyString(proxy: string): BrowserContextOptions["proxy"] | null {
  const trimmed = proxy.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.includes("://")) {
      const url = new URL(trimmed);
      return {
        server: `${url.protocol}//${url.host}`,
        username: url.username || undefined,
        password: url.password || undefined,
      };
    }
  } catch {
    // fall through
  }

  const parts = trimmed.split(":");
  if (parts.length >= 2) {
    const server = `http://${parts[0]}:${parts[1]}`;
    if (parts.length >= 4) {
      return { server, username: parts[2], password: parts[3] };
    }
    return { server };
  }

  return null;
}
