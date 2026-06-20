/**
 * VK Automation Worker — mock and real modes.
 *
 * Env (from .env.local / .env or process env):
 *   VK_WORKER_MODE=mock|real
 *   VK_WORKER_INTERVAL_MS=5000
 *   VK_WORKER_MAX_ATTEMPTS=3
 *   NEXT_PUBLIC_APP_URL=http://localhost:3000
 */

import fs from "fs";
import path from "path";
import { executeMockJob } from "../lib/vk-automation-worker-mock";
import { executeRealJob, formatVkError } from "../lib/vk-automation-worker-real";
import type { VkAutomationAction } from "../lib/vk-automation-queue-types";

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

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const QUEUE_API_URL = `${APP_URL}/api/vk-automation-queue`;
const WORKER_MODE = (process.env.VK_WORKER_MODE || "mock").trim().toLowerCase() === "real" ? "real" : "mock";
const INTERVAL_MS = Math.max(500, Number(process.env.VK_WORKER_INTERVAL_MS) || 5000);
const MAX_ATTEMPTS = Math.max(1, Number(process.env.VK_WORKER_MAX_ATTEMPTS) || 3);

const SUPPORTED_ACTIONS: VkAutomationAction[] = [
  "login_account",
  "create_group",
  "fill_description",
  "upload_avatar",
  "upload_cover",
  "publish_pinned_post",
  "publish_post",
  "save_result",
];

interface AutomationJob {
  id: string;
  taskId: string;
  accountId: string;
  action: VkAutomationAction;
  status: string;
  attempts: number;
  payload?: Record<string, unknown>;
}

interface ClaimResponse {
  success: boolean;
  job?: AutomationJob | null;
  error?: string;
  message?: string;
}

interface CompleteResponse {
  success: boolean;
  error?: string;
  job?: { status: string; attempts: number };
}

interface FetchJsonResult<T> {
  ok: boolean;
  status: number;
  url: string;
  data: T | null;
  rawText?: string;
  isJson: boolean;
}

function timestamp(): string {
  return new Date().toISOString();
}

function log(message: string): void {
  console.log(`[${timestamp()}] [mode=${WORKER_MODE}] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSupportedAction(value: string): value is VkAutomationAction {
  return (SUPPORTED_ACTIONS as readonly string[]).includes(value);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<FetchJsonResult<T>> {
  const response = await fetch(url, init);

  console.log("STATUS", response.status);
  console.log("URL", response.url);

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const rawText = await response.text();
    console.log(rawText);
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      data: null,
      rawText,
      isJson: false,
    };
  }

  const data = (await response.json()) as T;
  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    data,
    isJson: true,
  };
}

function formatNonJsonError(method: string, result: FetchJsonResult<unknown>): string {
  const preview = result.rawText?.slice(0, 300).replace(/\s+/g, " ").trim() || "(empty body)";
  return [
    `${method} ${QUEUE_API_URL} returned non-JSON (HTTP ${result.status}).`,
    `Final URL: ${result.url}`,
    `Expected API route: app/api/vk-automation-queue/route.ts (PATCH/PUT).`,
    `Check NEXT_PUBLIC_APP_URL=${APP_URL} — dev server must be running on this port.`,
    `Body preview: ${preview}`,
  ].join(" ");
}

async function claimNextJob(): Promise<ClaimResponse | null> {
  const result = await fetchJson<ClaimResponse>(QUEUE_API_URL, { method: "PATCH" });

  if (!result.isJson || !result.data) {
    log(formatNonJsonError("PATCH", result));
    return null;
  }

  const data = result.data;

  if (!result.ok || !data.success) {
    log(data.error || `PATCH failed with status ${result.status}`);
    return null;
  }

  return data;
}

async function completeJob(
  jobId: string,
  status: "success" | "failed",
  result?: Record<string, unknown>,
  error?: string,
  options?: { retry?: boolean }
): Promise<CompleteResponse | null> {
  const response = await fetchJson<CompleteResponse>(QUEUE_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId,
      status,
      result,
      error,
      retry: options?.retry === true,
      maxAttempts: MAX_ATTEMPTS,
    }),
  });

  if (!response.isJson || !response.data) {
    log(formatNonJsonError("PUT", response));
    return null;
  }

  const data = response.data;

  if (!response.ok || !data.success) {
    log(data.error || `PUT failed with status ${response.status}`);
    return null;
  }

  return data;
}

async function executeJob(job: AutomationJob): Promise<Record<string, unknown>> {
  const workerJob = {
    id: job.id,
    taskId: job.taskId,
    accountId: job.accountId,
    action: job.action,
    payload: job.payload,
  };

  if (WORKER_MODE === "mock") {
    return executeMockJob(workerJob);
  }

  return executeRealJob(workerJob);
}

async function processOnce(): Promise<boolean> {
  const claim = await claimNextJob();

  if (!claim) {
    return false;
  }

  if (!claim.job) {
    log("No pending automation jobs");
    return false;
  }

  const job = claim.job;

  if (!isSupportedAction(job.action)) {
    log(
      `FAILED action=${job.action} taskId=${job.taskId} accountId=${job.accountId} error=Unsupported action`
    );
    await completeJob(job.id, "failed", undefined, `Unsupported action: ${job.action}`);
    return true;
  }

  log(`CLAIMED job=${job.id} action=${job.action} taskId=${job.taskId} accountId=${job.accountId} attempts=${job.attempts}`);

  try {
    const result = await executeJob(job);
    const completed = await completeJob(job.id, "success", result);

    if (!completed) {
      log(`WARN job=${job.id} executed but PUT completion failed — check API URL`);
      return true;
    }

    if (WORKER_MODE === "real") {
      log(`VK API success action=${job.action} taskId=${job.taskId} accountId=${job.accountId}`);
    }

    log(`SUCCESS job=${job.id} action=${job.action} taskId=${job.taskId} accountId=${job.accountId}`);
  } catch (error) {
    const message = formatVkError(error);
    const canRetry = job.attempts < MAX_ATTEMPTS;

    if (WORKER_MODE === "real") {
      log(`VK API error action=${job.action} taskId=${job.taskId} accountId=${job.accountId} error=${message}`);
    }

    log(
      `FAILED job=${job.id} action=${job.action} taskId=${job.taskId} accountId=${job.accountId} attempts=${job.attempts}/${MAX_ATTEMPTS} error=${message}${canRetry ? " retry=pending" : ""}`
    );

    try {
      const complete = await completeJob(job.id, "failed", undefined, message, { retry: canRetry });
      if (complete?.job?.status === "pending") {
        log(`RETRY scheduled job=${job.id} action=${job.action} taskId=${job.taskId}`);
      }
      if (!complete) {
        log(`WARN job=${job.id} failure not reported to API — check API URL`);
      }
    } catch (completeError) {
      const completeMessage =
        completeError instanceof Error ? completeError.message : "Failed to report job failure";
      log(`ERROR job=${job.id} could not complete failure: ${completeMessage}`);
    }
  }

  return true;
}

async function runLoop(): Promise<void> {
  log(`VK Automation Worker started`);
  log(`APP_URL=${APP_URL}`);
  log(`QUEUE PATCH ${QUEUE_API_URL}`);
  log(`QUEUE PUT   ${QUEUE_API_URL}`);
  log(`interval=${INTERVAL_MS}ms maxAttempts=${MAX_ATTEMPTS}`);

  while (true) {
    try {
      const processed = await processOnce();
      if (!processed) {
        await sleep(INTERVAL_MS);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Worker loop error";
      log(`ERROR ${message}`);
      await sleep(INTERVAL_MS);
    }
  }
}

let shuttingDown = false;

function handleShutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Shutting down (${signal})`);
  process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

runLoop().catch((error) => {
  const message = error instanceof Error ? error.message : "Fatal worker error";
  log(`FATAL ${message}`);
  process.exit(1);
});
