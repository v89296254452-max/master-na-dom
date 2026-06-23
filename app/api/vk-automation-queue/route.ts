import { NextResponse } from "next/server";
import type { VkAutomationJobCompleteInput, VkAutomationJobStatus } from "@/lib/vk-automation-queue-types";
import { VK_AUTOMATION_JOB_STATUSES } from "@/lib/vk-automation-queue-types";
import {
  claimNextPendingAutomationJob,
  clearAutomationQueueCompletely,
  clearAutomationQueueStatuses,
  completeAutomationJob,
  computeAutomationQueueStats,
  computeAutomationReadiness,
  ensureVkAutomationQueueFile,
  generateAutomationQueue,
  getRecentAutomationJobs,
  getTaskPipelineOverview,
  readVkAutomationQueueFile,
  promoteAndGenerateAutomationQueue,
  recreateAutomationQueue,
  resetAndGenerateAutomationQueue,
  resetAndGenerateAutomationQueueForBindBatch,
  resetAndGenerateAutomationQueueForTaskIds,
  writeVkAutomationQueueFile,
} from "@/lib/vk-automation-queue";
import { normalizeTaskIdList } from "@/lib/vk-task-id-list";
import { getLatestVkUrlBindBatch } from "@/lib/vk-url-bind-batches";
import {
  VK_AUTOMATION_MANUAL_GROUP_MODE,
  type VkWorkerMode,
} from "@/lib/vk-automation-queue-types";

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
    manualGroupMode: VK_AUTOMATION_MANUAL_GROUP_MODE,
    stats: computeAutomationQueueStats(jobs),
    readiness: computeAutomationReadiness(jobs),
    recentJobs: getRecentAutomationJobs(jobs, 100),
    pipelineOverview: getTaskPipelineOverview(jobs),
    ...extra,
  };
}

export async function GET() {
  try {
    ensureVkAutomationQueueFile();

    return NextResponse.json({
      success: true,
      manualGroupMode: VK_AUTOMATION_MANUAL_GROUP_MODE,
      stats: computeAutomationQueueStats(readVkAutomationQueueFile()),
      readiness: computeAutomationReadiness(),
      recentJobs: getRecentAutomationJobs(readVkAutomationQueueFile(), 100),
      pipelineOverview: getTaskPipelineOverview(),
      workerMode: getWorkerMode(),
      maxAttempts: Number(process.env.VK_WORKER_MAX_ATTEMPTS) || 3,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить очередь";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function buildResetTaskIdsResponse(
  action: string,
  result: Awaited<ReturnType<typeof resetAndGenerateAutomationQueueForTaskIds>>,
  extra: Record<string, unknown> = {}
) {
  const messageParts = [
    `Удалено старых jobs: ${result.removed ?? 0}`,
    `Задач в очереди: ${result.tasksUsed ?? 0}`,
    `Создано jobs: ${result.created}`,
  ];

  if (typeof extra.batchId === "string" && extra.batchId.trim()) {
    messageParts.unshift(`batchId: ${extra.batchId}`);
  }

  if (result.taskIds && result.taskIds.length > 0) {
    messageParts.push(`taskIds: ${result.taskIds.join(", ")}`);
  }

  return buildQueueResponse({
    action,
    removed: result.removed ?? 0,
    tasksUsed: result.tasksUsed ?? 0,
    taskIds: result.taskIds ?? [],
    created: result.created,
    skipped: result.skipped,
    errors: result.errors,
    ...extra,
    message:
      result.errors.length > 0
        ? `${messageParts.join(". ")}. Ошибки: ${result.errors.join("; ")}`
        : messageParts.join(". "),
    success: result.created > 0 || (result.tasksUsed ?? 0) > 0 || result.errors.length === 0,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action.trim() : "generate";

    if (action === "clear_all") {
      const result = clearAutomationQueueCompletely();

      return NextResponse.json(
        buildQueueResponse({
          action: "clear_all",
          removed: result.removed,
          message: `Очередь полностью очищена. Удалено jobs: ${result.removed}`,
        })
      );
    }

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

    if (action === "promote_and_generate") {
      const result = await promoteAndGenerateAutomationQueue();

      const messageParts = [
        `Продвинуто в ready_for_worker: ${result.promoted}`,
        `Создано jobs: ${result.generate.created}`,
      ];

      return NextResponse.json(
        buildQueueResponse({
          action: "promote_and_generate",
          promoted: result.promoted,
          created: result.generate.created,
          skipped: result.generate.skipped,
          errors: result.generate.errors,
          message: messageParts.join(". "),
          success: result.generate.errors.length === 0 || result.generate.created > 0,
        })
      );
    }

    if (action === "reset_and_generate_task_ids" || action === "generate_selected") {
      const taskIds = normalizeTaskIdList(body.taskIds ?? body.taskIdsText);
      const result = await resetAndGenerateAutomationQueueForTaskIds(taskIds);

      return NextResponse.json(buildResetTaskIdsResponse(action, result));
    }

    if (action === "reset_and_generate_bind_batch" || action === "reset_and_generate_latest_bind") {
      const batchId =
        action === "reset_and_generate_latest_bind"
          ? (getLatestVkUrlBindBatch()?.batchId ?? "")
          : typeof body.batchId === "string"
            ? body.batchId.trim()
            : "";

      if (!batchId) {
        return NextResponse.json(
          { success: false, error: "batchId не найден. Сначала выполните массовую привязку." },
          { status: 400 }
        );
      }

      const result = await resetAndGenerateAutomationQueueForBindBatch(batchId);

      return NextResponse.json(
        buildResetTaskIdsResponse(action, result, { batchId })
      );
    }

    if (action === "reset_and_generate") {
      const result = await resetAndGenerateAutomationQueue();

      const messageParts = [
        `Удалено старых jobs: ${result.removed ?? 0}`,
        `Задач strict ready_for_worker: ${result.tasksUsed ?? 0}`,
        `Создано jobs: ${result.created}`,
      ];

      if (result.taskIds && result.taskIds.length > 0) {
        messageParts.push(`taskIds: ${result.taskIds.join(", ")}`);
      }

      return NextResponse.json(
        buildQueueResponse({
          action: "reset_and_generate",
          removed: result.removed ?? 0,
          tasksUsed: result.tasksUsed ?? 0,
          taskIds: result.taskIds ?? [],
          created: result.created,
          skipped: result.skipped,
          errors: result.errors,
          message:
            result.errors.length > 0
              ? `${messageParts.join(". ")}. Ошибки: ${result.errors.join("; ")}`
              : messageParts.join(". "),
          success: result.errors.length === 0 || result.created > 0 || (result.tasksUsed ?? 0) === 0,
        })
      );
    }

    if (action === "recreate") {
      const taskIds = Array.isArray(body.taskIds)
        ? body.taskIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        : undefined;

      const result = await recreateAutomationQueue(taskIds);

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

    const result = await generateAutomationQueue();

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

    if (body.status !== "success" && body.status !== "failed" && body.status !== "skipped") {
      return NextResponse.json(
        { success: false, error: "status должен быть success, failed или skipped" },
        { status: 400 }
      );
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
