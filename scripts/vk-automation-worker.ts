/**
 * VK Automation Worker — mock mode.
 * Polls /api/vk-automation-queue, executes jobs locally without real VK API.
 *
 * Env:
 *   VK_WORKER_MODE=mock
 *   VK_WORKER_INTERVAL_MS=2000
 *   NEXT_PUBLIC_APP_URL=http://localhost:3000
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const WORKER_MODE = (process.env.VK_WORKER_MODE || "mock").trim().toLowerCase();
const INTERVAL_MS = Math.max(500, Number(process.env.VK_WORKER_INTERVAL_MS) || 2000);

const SUPPORTED_ACTIONS = [
  "login_account",
  "create_group",
  "fill_description",
  "upload_avatar",
  "upload_cover",
  "publish_pinned_post",
  "publish_post",
  "save_result",
] as const;

type AutomationAction = (typeof SUPPORTED_ACTIONS)[number];

interface AutomationJob {
  id: string;
  taskId: string;
  accountId: string;
  action: AutomationAction;
  status: string;
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
}

function timestamp(): string {
  return new Date().toISOString();
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomMockDelayMs(): number {
  return 1000 + Math.floor(Math.random() * 1000);
}

function isSupportedAction(value: string): value is AutomationAction {
  return (SUPPORTED_ACTIONS as readonly string[]).includes(value);
}

async function claimNextJob(): Promise<ClaimResponse> {
  const res = await fetch(`${APP_URL}/api/vk-automation-queue`, { method: "PATCH" });
  const data = (await res.json()) as ClaimResponse;

  if (!res.ok || !data.success) {
    throw new Error(data.error || `PATCH failed with status ${res.status}`);
  }

  return data;
}

async function completeJob(
  jobId: string,
  status: "success" | "failed",
  result?: Record<string, unknown>,
  error?: string
): Promise<CompleteResponse> {
  const res = await fetch(`${APP_URL}/api/vk-automation-queue`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, status, result, error }),
  });

  const data = (await res.json()) as CompleteResponse;

  if (!res.ok || !data.success) {
    throw new Error(data.error || `PUT failed with status ${res.status}`);
  }

  return data;
}

function buildMockResult(job: AutomationJob): Record<string, unknown> {
  const base = {
    mock: true,
    message: "Action completed in mock mode",
  };

  if (job.action === "create_group") {
    return {
      ...base,
      vkUrl: `https://vk.com/club_mock_${job.taskId}`,
      vkGroupId: `mock_${job.taskId}`,
    };
  }

  if (job.action === "save_result") {
    const payload = job.payload ?? {};
    const vkUrl =
      typeof payload.vkUrl === "string" && payload.vkUrl.trim()
        ? payload.vkUrl.trim()
        : `https://vk.com/club_mock_${job.taskId}`;
    const vkGroupId =
      typeof payload.vkGroupId === "string" && payload.vkGroupId.trim()
        ? payload.vkGroupId.trim()
        : `mock_${job.taskId}`;
    const taskStatus =
      payload.taskStatus === "posted" || payload.taskStatus === "created"
        ? payload.taskStatus
        : "created";

    return {
      ...base,
      vkUrl,
      vkGroupId,
      taskStatus,
    };
  }

  return base;
}

async function executeMockJob(job: AutomationJob): Promise<Record<string, unknown>> {
  const delayMs = randomMockDelayMs();
  log(`EXECUTE action=${job.action} taskId=${job.taskId} accountId=${job.accountId} delay=${delayMs}ms`);
  await sleep(delayMs);
  return buildMockResult(job);
}

async function processOnce(): Promise<boolean> {
  const claim = await claimNextJob();

  if (!claim.job) {
    log("No pending automation jobs");
    return false;
  }

  const job = claim.job;

  if (!isSupportedAction(job.action)) {
    log(
      `FAILED job=${job.id} action=${job.action} taskId=${job.taskId} accountId=${job.accountId} error=Unsupported action`
    );
    await completeJob(job.id, "failed", undefined, `Unsupported action: ${job.action}`);
    return true;
  }

  log(`CLAIMED job=${job.id} action=${job.action} taskId=${job.taskId} accountId=${job.accountId}`);

  try {
    if (WORKER_MODE !== "mock") {
      throw new Error(`Mode "${WORKER_MODE}" is not implemented. Use VK_WORKER_MODE=mock`);
    }

    const result = await executeMockJob(job);
    await completeJob(job.id, "success", result);
    log(`SUCCESS job=${job.id} action=${job.action} taskId=${job.taskId} accountId=${job.accountId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    log(`FAILED job=${job.id} action=${job.action} taskId=${job.taskId} accountId=${job.accountId} error=${message}`);

    try {
      await completeJob(job.id, "failed", undefined, message);
    } catch (completeError) {
      const completeMessage =
        completeError instanceof Error ? completeError.message : "Failed to report job failure";
      log(`ERROR job=${job.id} could not complete failure: ${completeMessage}`);
    }
  }

  return true;
}

async function runLoop(): Promise<void> {
  log(`VK Automation Worker started mode=${WORKER_MODE} url=${APP_URL} interval=${INTERVAL_MS}ms`);

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
