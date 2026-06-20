import { NextResponse } from "next/server";
import type { VkAutomationJobCompleteInput, VkAutomationJobStatus } from "@/lib/vk-automation-queue-types";
import { VK_AUTOMATION_JOB_STATUSES } from "@/lib/vk-automation-queue-types";
import {
  claimNextPendingAutomationJob,
  clearAutomationQueueStatuses,
  completeAutomationJob,
  computeAutomationQueueStats,
  ensureVkAutomationQueueFile,
  generateAutomationQueue,
  getRecentAutomationJobs,
  readVkAutomationQueueFile,
  recreateAutomationQueue,
  writeVkAutomationQueueFile,
} from "@/lib/vk-automation-queue";

import type { VkWorkerMode } from "@/lib/vk-automation-queue-types";

function getWorkerMode(): VkWorkerMode {
  const mode = (process.env.VK_WORKER_MODE || "mock").trim().toLowerCase();
  return mode === "real" ? "real" : "mock";
}

function isJobStatus(value: unknown): value is VkAutomationJobStatus {
  return typeof value === "string" && VK_AUTOMATION_JOB_STATUSES.includes(value as VkAutomationJobStatus);
}

function parseStatuses(value: unknown, fallback: VkAutomationJobStatus[]): VkAutomationJobStatus[] {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.filter(isJobStatus);
  return parsed.length > 0 ? parsed : fallback;
}

function buildQueueResponse(extra: Record<string, unknown> = {}) {
  const jobs = readVkAutomationQueueFile();
  return {
    success: true,
    stats: computeAutomationQueueStats(jobs),
    recentJobs: getRecentAutomationJobs(jobs, 100),
    ...extra,
  };
}

export async function GET() {
  try {
    ensureVkAutomationQueueFile();

    return NextResponse.json({
      success: true,
      stats: computeAutomationQueueStats(readVkAutomationQueueFile()),
      recentJobs: getRecentAutomationJobs(readVkAutomationQueueFile(), 100),
      workerMode: getWorkerMode(),
      maxAttempts: Number(process.env.VK_WORKER_MAX_ATTEMPTS) || 3,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить очередь";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action.trim() : "generate";

    if (action === "clear") {
      const statuses = parseStatuses(body.statuses, ["skipped", "failed", "success"]);
      const result = clearAutomationQueueStatuses(statuses);

      return NextResponse.json(
        buildQueueResponse({
          removed: result.removed,
          message: `Удалено jobs: ${result.removed} (${statuses.join(", ")})`,
        })
      );
    }

    if (action === "recreate") {
      const taskIds = Array.isArray(body.taskIds)
        ? body.taskIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        : undefined;

      const result = recreateAutomationQueue(taskIds);

      const messageParts = [
        `Удалено: ${result.removed ?? 0}`,
        `Создано jobs: ${result.created}`,
        `Пропущено: ${result.skipped}`,
      ];

      return NextResponse.json(
        buildQueueResponse({
          action: "recreate",
          created: result.created,
          skipped: result.skipped,
          removed: result.removed,
          errors: result.errors,
          message: messageParts.join(". "),
          success: result.errors.length === 0 || result.created > 0,
        })
      );
    }

    const result = generateAutomationQueue();

    return NextResponse.json(
      buildQueueResponse({
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
        message:
          result.errors.length > 0
            ? `Создано jobs: ${result.created}. Ошибки: ${result.errors.join("; ")}`
            : `Создано jobs: ${result.created}, пропущено: ${result.skipped}`,
        success: result.errors.length === 0 || result.created > 0,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить операцию с очередью";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const jobs = readVkAutomationQueueFile();
    const job = claimNextPendingAutomationJob(jobs);

    if (!job) {
      return NextResponse.json({ success: true, job: null, message: "No pending automation jobs" });
    }

    writeVkAutomationQueueFile(jobs);
    return NextResponse.json({ success: true, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось взять задачу из очереди";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";

    if (!jobId) {
      return NextResponse.json({ success: false, error: "jobId обязателен" }, { status: 400 });
    }

    if (body.status !== "success" && body.status !== "failed") {
      return NextResponse.json({ success: false, error: "status должен быть success или failed" }, { status: 400 });
    }

    const input: VkAutomationJobCompleteInput = {
      jobId,
      status: body.status,
      result: body.result && typeof body.result === "object" ? body.result : undefined,
      error: typeof body.error === "string" ? body.error : undefined,
      retry: body.retry === true,
      maxAttempts:
        typeof body.maxAttempts === "number" && body.maxAttempts > 0
          ? Math.floor(body.maxAttempts)
          : Number(process.env.VK_WORKER_MAX_ATTEMPTS) || 3,
    };

    const jobs = readVkAutomationQueueFile();
    const updated = completeAutomationJob(jobs, input);

    if (!updated) {
      return NextResponse.json({ success: false, error: "Job не найден" }, { status: 404 });
    }

    writeVkAutomationQueueFile(jobs);
    return NextResponse.json({ success: true, job: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось завершить automation job";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
