/**
 * VK Browser Worker — Playwright automation (не VK API).
 *
 * Env: VK_AUTOMATION_DB_PATH, VK_BROWSER_HEADLESS, VK_WORKER_INTERVAL_MS, etc.
 * Запуск: npm run vk:worker
 */

import fs from "fs";
import path from "path";
import { openAuthForAccount, checkAuthForAccount } from "../lib/vk-automation/auth";
import { closeContext, closeSharedBrowser, openAccountContext } from "../lib/vk-automation/browser";
import { VK_AUTOMATION_CONFIG } from "../lib/vk-automation/config";
import { claimNextJob, completeJob, closeVkAutomationDb } from "../lib/vk-automation/db";
import { createTestGroup, createGroupFromTask, createGroupFromMasterTask } from "../lib/vk-automation/groups";
import { createJobLogger } from "../lib/vk-automation/logger";
import { isTransientError } from "../lib/vk-automation/queue";
import { getWorkerBrowserAccount, getLegacyBrowserAccount } from "../lib/vk-automation/sync-master-account";
import type { VkBrowserJob } from "../lib/vk-automation/types";
import type { VkGroupCreationTask } from "../lib/master-data/types";
import { getBrowserAccountMergeError } from "../lib/master-data/accounts";
import { getMasterDataSource } from "../lib/master-data/source";

function loadEnvFile(filename: string): void {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const INTERVAL_MS = VK_AUTOMATION_CONFIG.workerIntervalMs;
const MAX_ATTEMPTS = VK_AUTOMATION_CONFIG.workerMaxAttempts;

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] [vk-worker] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function needsHeadedBrowser(action: VkBrowserJob["action"]): boolean {
  return action === "auth_open";
}

async function executeJob(job: VkBrowserJob): Promise<Record<string, unknown>> {
  const source = getMasterDataSource();
  const account =
    source === "project"
      ? getWorkerBrowserAccount(job.accountId)
      : getLegacyBrowserAccount(job.accountId);

  if (!account) {
    const message =
      source === "project"
        ? getBrowserAccountMergeError(job.accountId)
        : `Account not found: ${job.accountId}`;
    throw new Error(message);
  }

  const logger = createJobLogger(job.id, job.accountId);
  logger.info(`Start action=${job.action}`);

  const headless = needsHeadedBrowser(job.action) ? false : VK_AUTOMATION_CONFIG.browserHeadless;
  const context = await openAccountContext(account, logger, { headless });

  try {
    switch (job.action) {
      case "auth_open": {
        const result = await openAuthForAccount(context, account, job.id, logger);
        return { ...result };
      }
      case "auth_check": {
        const result = await checkAuthForAccount(context, account, job.id, logger);
        return { ...result };
      }
      case "create_test_group": {
        const result = await createTestGroup(context, account, job.id, logger);
        return { ...result };
      }
      case "create_group": {
        if (!job.taskId) throw new Error("taskId required for create_group");
        const result = await createGroupFromTask(context, account, job.taskId, job.id, logger);
        return { ...result };
      }
      case "create_group_full": {
        const masterTask = job.payload.masterTask as VkGroupCreationTask | undefined;
        if (!masterTask) throw new Error("masterTask required in payload");
        const result = await createGroupFromMasterTask(context, account, masterTask, job.id, logger);
        return { ...result };
      }
      default:
        throw new Error(`Unsupported action: ${job.action}`);
    }
  } finally {
    await closeContext(context);
  }
}

async function processOnce(): Promise<boolean> {
  const job = claimNextJob();
  if (!job) {
    log("No pending jobs");
    return false;
  }

  log(`CLAIMED job=${job.id} action=${job.action} account=${job.accountId} attempts=${job.attempts}`);

  try {
    const result = await executeJob(job);
    const success = result.success === true || result.success === undefined;

    if (!success) {
      const message = typeof result.message === "string" ? result.message : "Job failed";
      const canRetry = job.attempts < MAX_ATTEMPTS && isTransientError(message);
      completeJob(job.id, canRetry ? "pending" : "failed", result, message, canRetry, MAX_ATTEMPTS);
      log(`FAILED job=${job.id} error=${message}${canRetry ? " retry=pending" : ""}`);
      return true;
    }

    completeJob(job.id, "success", result);
    log(`SUCCESS job=${job.id} action=${job.action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker error";
    const canRetry = job.attempts < MAX_ATTEMPTS && isTransientError(message);
    completeJob(job.id, canRetry ? "pending" : "failed", {}, message, canRetry, MAX_ATTEMPTS);
    log(`ERROR job=${job.id} error=${message}${canRetry ? " retry=pending" : ""}`);
  }

  return true;
}

async function runLoop(): Promise<void> {
  log("VK Browser Worker started");
  log(`DB=${VK_AUTOMATION_CONFIG.dbPath}`);
  log(`interval=${INTERVAL_MS}ms maxAttempts=${MAX_ATTEMPTS}`);

  while (true) {
    try {
      const processed = await processOnce();
      if (!processed) {
        await sleep(INTERVAL_MS);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Loop error";
      log(`LOOP ERROR ${message}`);
      await sleep(INTERVAL_MS);
    }
  }
}

let shuttingDown = false;

function handleShutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Shutting down (${signal})`);
  closeVkAutomationDb();
  closeSharedBrowser()
    .catch(() => undefined)
    .finally(() => process.exit(0));
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

runLoop().catch((error) => {
  const message = error instanceof Error ? error.message : "Fatal";
  log(`FATAL ${message}`);
  process.exit(1);
});
