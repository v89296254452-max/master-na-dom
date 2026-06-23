import fs from "fs";
import path from "path";
import type {
  VkAutomationAction,
  VkAutomationClearResult,
  VkAutomationGenerateResult,
  VkAutomationJob,
  VkAutomationJobCompleteInput,
  VkAutomationJobStatus,
  VkAutomationQueueStats,
} from "./vk-automation-queue-types";
import { VK_AUTOMATION_ACTIONS } from "./vk-automation-queue-types";
import {
  computeAutomationReadinessStats,
  explainTaskNotStrictReady,
  getAutomationTargetTasks,
  isTaskReadyForWorker,
} from "./vk-automation-readiness";
import { getVkAccountById, readVkAccountsFile } from "./vk-accounts";
import { appendVkTaskLogEntry } from "./vk-task-log";
import type { VkTaskStatus } from "./vk-task-types";
import { VK_TASK_STATUSES } from "./vk-task-types";
import {
  promoteEligibleTasksToReady,
  reconcileBrokenReadyForWorkerTasks,
} from "./vk-task-status-server";
import { normalizeTaskIdList } from "./vk-task-id-list";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "./vk-tasks";
import {
  WORKER_PIPELINE,
  buildTaskPipelineOverview,
  checkPredecessorForClaim,
  enforcePipelineSkipsForBlockedPending,
  isWorkerPipelineAction,
  pipelineJobId,
  predecessorFailureMessage,
  skipPendingJob,
  sortPendingJobsForClaim,
} from "./vk-automation-pipeline";
import type { TaskPipelineOverviewRow, WorkerPipelineAction } from "./vk-automation-pipeline";

const VK_AUTOMATION_QUEUE_PATH = path.join(process.cwd(), "data", "vk-automation-queue.json");

function nowIso(): string {
  return new Date().toISOString();
}

function isAutomationAction(value: unknown): value is VkAutomationAction {
  return typeof value === "string" && VK_AUTOMATION_ACTIONS.includes(value as VkAutomationAction);
}

function isJobStatus(value: unknown): value is VkAutomationJobStatus {
  return (
    value === "pending" ||
    value === "running" ||
    value === "success" ||
    value === "failed" ||
    value === "skipped"
  );
}

function toAttempts(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeJob(raw: Partial<VkAutomationJob>): VkAutomationJob | null {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const taskId = typeof raw.taskId === "string" ? raw.taskId.trim() : "";
  const accountId = typeof raw.accountId === "string" ? raw.accountId.trim() : "";

  if (!id || !taskId || !accountId || !isAutomationAction(raw.action)) {
    return null;
  }

  const timestamp = nowIso();

  return {
    id,
    taskId,
    accountId,
    action: raw.action,
    status: isJobStatus(raw.status) ? raw.status : "pending",
    payload: normalizeRecord(raw.payload),
    result: normalizeRecord(raw.result),
    error: typeof raw.error === "string" ? raw.error : "",
    attempts: toAttempts(raw.attempts),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : timestamp,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : timestamp,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : "",
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : "",
  };
}

export function readVkAutomationQueueFile(): VkAutomationJob[] {
  if (!fs.existsSync(VK_AUTOMATION_QUEUE_PATH)) {
    return [];
  }

  const content = fs.readFileSync(VK_AUTOMATION_QUEUE_PATH, "utf-8");
  const parsed = JSON.parse(content) as Partial<VkAutomationJob>[];

  if (!Array.isArray(parsed)) {
    throw new Error("data/vk-automation-queue.json должен содержать массив jobs");
  }

  return parsed.map((item) => normalizeJob(item)).filter((item): item is VkAutomationJob => item !== null);
}

export function writeVkAutomationQueueFile(jobs: VkAutomationJob[]): void {
  fs.mkdirSync(path.dirname(VK_AUTOMATION_QUEUE_PATH), { recursive: true });
  fs.writeFileSync(VK_AUTOMATION_QUEUE_PATH, JSON.stringify(jobs, null, 2) + "\n", "utf-8");
}

export function ensureVkAutomationQueueFile(): VkAutomationJob[] {
  if (!fs.existsSync(VK_AUTOMATION_QUEUE_PATH)) {
    writeVkAutomationQueueFile([]);
    return [];
  }

  return readVkAutomationQueueFile();
}

export function computeAutomationQueueStats(jobs: VkAutomationJob[]): VkAutomationQueueStats {
  return {
    total: jobs.length,
    pending: jobs.filter((job) => job.status === "pending").length,
    running: jobs.filter((job) => job.status === "running").length,
    success: jobs.filter((job) => job.status === "success").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    skipped: jobs.filter((job) => job.status === "skipped").length,
  };
}

export function computeAutomationReadiness(
  jobs: VkAutomationJob[] = readVkAutomationQueueFile()
) {
  const tasks = readVkTasksFile();
  const accounts = readVkAccountsFile();
  return computeAutomationReadinessStats(tasks, jobs, accounts);
}

export function getRecentAutomationJobs(jobs: VkAutomationJob[], limit = 100): VkAutomationJob[] {
  return [...jobs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export type { TaskPipelineOverviewRow };

/** @deprecated use WORKER_PIPELINE from vk-automation-pipeline */
const READY_WORKER_PIPELINE: Array<{ action: VkAutomationAction; payload?: Record<string, unknown> }> =
  WORKER_PIPELINE.map((action) =>
    action === "save_result" ? { action, payload: { taskStatus: "posted" } } : { action }
  );

function hasActivePipelineJob(jobs: VkAutomationJob[], jobId: string): boolean {
  return jobs.some(
    (job) =>
      job.id === jobId &&
      (job.status === "pending" || job.status === "running" || job.status === "success")
  );
}

function appendPipelineJobsForTask(
  jobs: VkAutomationJob[],
  task: ReturnType<typeof readVkTasksFile>[number],
  accountId: string,
  timestamp: string
): number {
  let taskJobsCreated = 0;

  for (const step of READY_WORKER_PIPELINE) {
    const jobId = pipelineJobId(task.id, step.action);
    if (hasActivePipelineJob(jobs, jobId)) continue;

    const job = normalizeJob({
      id: jobId,
      taskId: task.id,
      accountId,
      action: step.action,
      status: "pending",
      payload: step.payload ?? {},
      result: {},
      error: "",
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: "",
      completedAt: "",
    });

    if (!job) continue;

    jobs.push(job);
    taskJobsCreated += 1;
  }

  return taskJobsCreated;
}

function generateJobsForTasks(
  jobs: VkAutomationJob[],
  tasks: ReturnType<typeof readVkTasksFile>,
  accounts: ReturnType<typeof readVkAccountsFile>,
  errors: string[]
): { created: number; skipped: number } {
  const timestamp = nowIso();
  let created = 0;
  let skipped = 0;

  for (const task of tasks) {
    if (!task.vkGroupId.trim()) {
      continue;
    }

    if (!isTaskReadyForWorker(task, accounts)) {
      continue;
    }

    const accountId = task.assignedAccount.trim();
    const account = getVkAccountById(accountId, accounts);
    if (!account) {
      errors.push(`${task.id}: аккаунт "${accountId}" не найден`);
      skipped += 1;
      continue;
    }

    const taskJobsCreated = appendPipelineJobsForTask(jobs, task, accountId, timestamp);
    created += taskJobsCreated;

    if (taskJobsCreated === 0) {
      skipped += 1;
    }
  }

  return { created, skipped };
}

function purgeIneligibleAutomationJobs(
  jobs: VkAutomationJob[],
  tasks: ReturnType<typeof readVkTasksFile>,
  accounts: ReturnType<typeof readVkAccountsFile>
): { jobs: VkAutomationJob[]; removed: number } {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const before = jobs.length;
  const remaining = jobs.filter((job) => {
    const task = taskMap.get(job.taskId);
    if (!task || !task.vkGroupId.trim()) {
      return false;
    }
    return isTaskReadyForWorker(task, accounts);
  });

  return {
    jobs: remaining,
    removed: before - remaining.length,
  };
}

function resolveSelectedTasksForQueue(
  requestedIds: string[],
  tasks: ReturnType<typeof readVkTasksFile>,
  accounts: ReturnType<typeof readVkAccountsFile>,
  errors: string[]
): ReturnType<typeof readVkTasksFile> {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const targetTasks: ReturnType<typeof readVkTasksFile> = [];

  for (const taskId of requestedIds) {
    const task = taskMap.get(taskId);
    if (!task) {
      errors.push(`${taskId}: задача не найдена`);
      continue;
    }

    if (!isTaskReadyForWorker(task, accounts)) {
      errors.push(explainTaskNotStrictReady(task, accounts));
      continue;
    }

    targetTasks.push(task);
  }

  return targetTasks;
}

function buildFreshAutomationQueueForTaskIds(
  taskIds: string[],
  accounts: ReturnType<typeof readVkAccountsFile>,
  tasks: ReturnType<typeof readVkTasksFile>,
  errors: string[]
): {
  jobs: VkAutomationJob[];
  targetTasks: ReturnType<typeof readVkTasksFile>;
  created: number;
  skipped: number;
} {
  const targetTasks = resolveSelectedTasksForQueue(taskIds, tasks, accounts, errors);
  const jobs: VkAutomationJob[] = [];
  const { created, skipped } = generateJobsForTasks(jobs, targetTasks, accounts, errors);

  return { jobs, targetTasks, created, skipped };
}

function buildFreshAutomationQueue(
  accounts: ReturnType<typeof readVkAccountsFile>,
  tasks: ReturnType<typeof readVkTasksFile>,
  errors: string[]
): { jobs: VkAutomationJob[]; targetTasks: ReturnType<typeof readVkTasksFile>; created: number; skipped: number } {
  const targetTasks = getAutomationTargetTasks(tasks, accounts);
  const jobs: VkAutomationJob[] = [];
  const { created, skipped } = generateJobsForTasks(jobs, targetTasks, accounts, errors);

  return { jobs, targetTasks, created, skipped };
}

function prepareAutomationTasksForQueue(): number {
  const tasks = readVkTasksFile();
  const accounts = readVkAccountsFile();
  const demoted = reconcileBrokenReadyForWorkerTasks(tasks, accounts);

  if (demoted > 0) {
    writeVkTasksFile(tasks);
  }

  return demoted;
}

export function clearAutomationQueueStatuses(
  statuses: VkAutomationJobStatus[]
): VkAutomationClearResult {
  const statusSet = new Set(statuses);
  const jobs = readVkAutomationQueueFile();
  const before = jobs.length;
  const remaining = jobs.filter((job) => !statusSet.has(job.status));
  const removed = before - remaining.length;

  writeVkAutomationQueueFile(remaining);

  return {
    removed,
    stats: computeAutomationQueueStats(remaining),
  };
}

/** Полностью очищает data/vk-automation-queue.json (все статусы). */
export function clearAutomationQueueCompletely(): VkAutomationClearResult {
  const removed = readVkAutomationQueueFile().length;
  writeVkAutomationQueueFile([]);

  return {
    removed,
    stats: computeAutomationQueueStats([]),
  };
}

const RECREATE_REMOVE_STATUSES: VkAutomationJobStatus[] = [
  "pending",
  "running",
  "skipped",
  "failed",
  "success",
];

export function removeJobsForTasks(
  jobs: VkAutomationJob[],
  taskIds: Set<string>,
  statuses: VkAutomationJobStatus[]
): { jobs: VkAutomationJob[]; removed: number } {
  const statusSet = new Set(statuses);
  const before = jobs.length;
  const remaining = jobs.filter(
    (job) => !(taskIds.has(job.taskId) && statusSet.has(job.status))
  );

  return {
    jobs: remaining,
    removed: before - remaining.length,
  };
}

export interface VkAutomationPromoteResult {
  promoted: number;
  generate: VkAutomationGenerateResult;
}

export function promoteReadyTasksAndSave(): number {
  const tasks = readVkTasksFile();
  const accounts = readVkAccountsFile();
  const promoted = promoteEligibleTasksToReady(tasks, accounts);
  if (promoted > 0) {
    writeVkTasksFile(tasks);
  }
  return promoted;
}

export async function resetAndGenerateAutomationQueueForBindBatch(
  batchId: string
): Promise<VkAutomationGenerateResult> {
  const normalized = batchId.trim();
  if (!normalized) {
    return {
      created: 0,
      skipped: 0,
      removed: 0,
      tasksUsed: 0,
      taskIds: [],
      errors: ["batchId обязателен"],
      stats: computeAutomationQueueStats(readVkAutomationQueueFile()),
    };
  }

  const tasks = readVkTasksFile();
  const taskIds = tasks
    .filter((task) => task.lastBindBatchId.trim() === normalized)
    .map((task) => task.id);

  if (taskIds.length === 0) {
    return {
      created: 0,
      skipped: 0,
      removed: readVkAutomationQueueFile().length,
      tasksUsed: 0,
      taskIds: [],
      errors: [`Нет задач с lastBindBatchId = ${normalized}`],
      stats: computeAutomationQueueStats([]),
    };
  }

  const result = await resetAndGenerateAutomationQueueForTaskIds(taskIds);
  return {
    ...result,
    errors: result.errors.length > 0 ? result.errors : [],
  };
}

export async function resetAndGenerateAutomationQueueForTaskIds(
  taskIdsInput: string[] | string
): Promise<VkAutomationGenerateResult> {
  const taskIds = normalizeTaskIdList(taskIdsInput);

  if (taskIds.length === 0) {
    return {
      created: 0,
      skipped: 0,
      removed: 0,
      tasksUsed: 0,
      taskIds: [],
      errors: ["Список taskIds пуст"],
      stats: computeAutomationQueueStats(readVkAutomationQueueFile()),
    };
  }

  const removed = readVkAutomationQueueFile().length;
  writeVkAutomationQueueFile([]);

  prepareAutomationTasksForQueue();

  const accounts = readVkAccountsFile();
  const tasks = readVkTasksFile();
  const errors: string[] = [];
  const { jobs, targetTasks, created, skipped } = buildFreshAutomationQueueForTaskIds(
    taskIds,
    accounts,
    tasks,
    errors
  );

  writeVkAutomationQueueFile(jobs);

  return {
    removed,
    tasksUsed: targetTasks.length,
    taskIds: targetTasks.map((task) => task.id),
    created,
    skipped,
    errors,
    stats: computeAutomationQueueStats(jobs),
  };
}

export async function resetAndGenerateAutomationQueue(): Promise<VkAutomationGenerateResult> {
  const removed = readVkAutomationQueueFile().length;
  writeVkAutomationQueueFile([]);

  prepareAutomationTasksForQueue();

  const accounts = readVkAccountsFile();
  const tasks = readVkTasksFile();
  const errors: string[] = [];
  const { jobs, targetTasks, created, skipped } = buildFreshAutomationQueue(accounts, tasks, errors);

  writeVkAutomationQueueFile(jobs);

  const taskIds = targetTasks.map((task) => task.id);

  return {
    removed,
    tasksUsed: targetTasks.length,
    taskIds,
    created,
    skipped,
    errors,
    stats: computeAutomationQueueStats(jobs),
  };
}

export async function promoteAndGenerateAutomationQueue(): Promise<VkAutomationPromoteResult> {
  const promoted = promoteReadyTasksAndSave();
  const generate = await generateAutomationQueue();

  return { promoted, generate };
}

export async function recreateAutomationQueue(taskIds?: string[]): Promise<VkAutomationGenerateResult> {
  prepareAutomationTasksForQueue();
  const tasks = readVkTasksFile();
  const accounts = readVkAccountsFile();
  const targetTasks = getAutomationTargetTasks(tasks, accounts, taskIds);
  const targetTaskIdSet = new Set(targetTasks.map((task) => task.id));
  const errors: string[] = [];

  if (targetTasks.length === 0) {
    return {
      created: 0,
      skipped: 0,
      removed: 0,
      errors: taskIds?.length
        ? ["Нет задач ready_for_worker для указанных taskId"]
        : ["Нет задач ready_for_worker"],
      stats: computeAutomationQueueStats(readVkAutomationQueueFile()),
    };
  }

  let jobs = readVkAutomationQueueFile();
  const { jobs: afterRemove, removed } = removeJobsForTasks(
    jobs,
    targetTaskIdSet,
    RECREATE_REMOVE_STATUSES
  );
  jobs = afterRemove;

  const freshTasks = readVkTasksFile();
  const preparedTargets = freshTasks.filter((task) => targetTaskIdSet.has(task.id));
  const { created, skipped } = generateJobsForTasks(jobs, preparedTargets, accounts, errors);
  writeVkAutomationQueueFile(jobs);

  return {
    created,
    skipped,
    removed,
    errors,
    stats: computeAutomationQueueStats(jobs),
  };
}

export async function generateAutomationQueue(): Promise<VkAutomationGenerateResult> {
  prepareAutomationTasksForQueue();

  const accounts = readVkAccountsFile();
  const tasks = readVkTasksFile();
  const errors: string[] = [];

  let jobs = readVkAutomationQueueFile();
  const { jobs: purgedJobs, removed: purged } = purgeIneligibleAutomationJobs(jobs, tasks, accounts);
  jobs = purgedJobs;

  const targetTasks = getAutomationTargetTasks(tasks, accounts);

  if (targetTasks.length === 0 && jobs.length === 0) {
    writeVkAutomationQueueFile([]);
    return {
      created: 0,
      skipped: 0,
      removed: purged,
      tasksUsed: 0,
      taskIds: [],
      errors: ["Нет задач strict ready_for_worker (vkGroupId + connected account)"],
      stats: computeAutomationQueueStats([]),
    };
  }

  const { created, skipped } = generateJobsForTasks(jobs, targetTasks, accounts, errors);
  writeVkAutomationQueueFile(jobs);

  return {
    created,
    skipped,
    removed: purged,
    tasksUsed: targetTasks.length,
    taskIds: targetTasks.map((task) => task.id),
    errors,
    stats: computeAutomationQueueStats(jobs),
  };
}

function isTaskStatus(value: unknown): value is VkTaskStatus {
  return typeof value === "string" && VK_TASK_STATUSES.includes(value as VkTaskStatus);
}

function applySaveResultToTask(job: VkAutomationJob, result: Record<string, unknown>): void {
  const vkUrl = typeof result.vkUrl === "string" ? result.vkUrl.trim() : "";
  const vkGroupId = typeof result.vkGroupId === "string" ? result.vkGroupId.trim() : "";
  const taskStatus = isTaskStatus(result.taskStatus) ? result.taskStatus : "filled";

  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === job.taskId);

  if (!existing) {
    throw new Error(`Задача ${job.taskId} не найдена для save_result`);
  }

  const updated = updateVkTask(tasks, job.taskId, {
    vkUrl: vkUrl || existing.vkUrl,
    vkGroupId: vkGroupId || existing.vkGroupId,
    status: taskStatus,
  });

  if (!updated) {
    throw new Error(`Не удалось обновить задачу ${job.taskId}`);
  }

  writeVkTasksFile(tasks);

  appendVkTaskLogEntry({
    taskId: job.taskId,
    action: "updated",
    oldStatus: existing.status,
    newStatus: updated.status,
    assignedAccount: updated.assignedAccount,
    vkUrl: updated.vkUrl,
    vkGroupId: updated.vkGroupId,
    message: "Automation save_result",
  });
}

function isTaskEligibleForPipeline(
  task: ReturnType<typeof readVkTasksFile>[number],
  accounts: ReturnType<typeof readVkAccountsFile>
): boolean {
  return isTaskReadyForWorker(task, accounts);
}

export function getTaskPipelineOverview(jobs: VkAutomationJob[] = readVkAutomationQueueFile()): TaskPipelineOverviewRow[] {
  const overview = buildTaskPipelineOverview(jobs);
  const overviewByTaskId = new Map(overview.map((row) => [row.taskId, row]));
  const accounts = readVkAccountsFile();
  const tasks = readVkTasksFile().filter((task) => isTaskReadyForWorker(task, accounts));

  const merged: TaskPipelineOverviewRow[] = [];

  for (const task of tasks.sort((a, b) => a.id.localeCompare(b.id))) {
    const existing = overviewByTaskId.get(task.id);
    if (existing) {
      merged.push(existing);
      continue;
    }

    const steps = {} as Record<WorkerPipelineAction, VkAutomationJobStatus | "—">;
    for (const action of WORKER_PIPELINE) {
      steps[action] = "—";
    }

    merged.push({
      taskId: task.id,
      accountId: task.assignedAccount.trim(),
      steps,
    });
  }

  return merged;
}

export function claimNextPendingAutomationJob(jobs: VkAutomationJob[]): VkAutomationJob | null {
  const timestamp = nowIso();

  enforcePipelineSkipsForBlockedPending(jobs);

  const orderedIndices = sortPendingJobsForClaim(jobs);
  const tasks = readVkTasksFile();
  const accounts = readVkAccountsFile();
  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  for (const index of orderedIndices) {
    const job = jobs[index];
    if (job.status !== "pending" || !isWorkerPipelineAction(job.action)) {
      continue;
    }

    const task = taskMap.get(job.taskId);
    if (!task || !isTaskEligibleForPipeline(task, accounts)) {
      if (task && !task.vkGroupId.trim()) {
        jobs[index] = skipPendingJob(job, "Task is not ready: vkGroupId missing", timestamp);
      }
      continue;
    }

    const check = checkPredecessorForClaim(jobs, job.taskId, job.action);
    if (check === "block") {
      jobs[index] = skipPendingJob(job, predecessorFailureMessage(job.action), timestamp);
      continue;
    }
    if (check === "wait") {
      continue;
    }

    const claimed: VkAutomationJob = {
      ...job,
      status: "running",
      attempts: job.attempts + 1,
      startedAt: timestamp,
      updatedAt: timestamp,
      error: "",
    };

    jobs[index] = claimed;
    return claimed;
  }

  return null;
}

export function completeAutomationJob(
  jobs: VkAutomationJob[],
  input: VkAutomationJobCompleteInput
): VkAutomationJob | null {
  const jobId = input.jobId.trim();
  const index = jobs.findIndex((job) => job.id === jobId);

  if (index === -1) {
    return null;
  }

  const job = jobs[index];
  const timestamp = nowIso();
  const maxAttempts = input.maxAttempts ?? 3;
  const shouldRetry =
    input.status === "failed" && input.retry === true && job.attempts < maxAttempts;

  if (shouldRetry) {
    const retried: VkAutomationJob = {
      ...job,
      status: "pending",
      error: input.error?.trim() || "Automation failed",
      updatedAt: timestamp,
      startedAt: "",
      completedAt: "",
    };

    jobs[index] = retried;
    return retried;
  }

  const status: VkAutomationJobStatus =
    input.status === "failed" ? "failed" : input.status === "skipped" ? "skipped" : "success";

  const updated: VkAutomationJob = {
    ...job,
    status,
    result: input.result ? normalizeRecord(input.result) : job.result,
    error:
      input.status === "failed" || input.status === "skipped"
        ? (input.error?.trim() || (input.status === "skipped" ? "Skipped" : "Automation failed"))
        : "",
    updatedAt: timestamp,
    completedAt: timestamp,
  };

  jobs[index] = updated;

  if (updated.action === "save_result" && status === "success") {
    applySaveResultToTask(updated, updated.result);
  }

  if (status === "failed" && isWorkerPipelineAction(updated.action)) {
    enforcePipelineSkipsForBlockedPending(jobs);
  }

  return updated;
}

export function enqueueAutomationJob(
  jobs: VkAutomationJob[],
  input: Omit<VkAutomationJob, "status" | "result" | "error" | "startedAt" | "completedAt"> & {
    status?: VkAutomationJobStatus;
  }
): VkAutomationJob {
  const timestamp = nowIso();
  const job = normalizeJob({
    ...input,
    status: input.status ?? "pending",
    result: {},
    error: "",
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: "",
    completedAt: "",
  });

  if (!job) {
    throw new Error("Некорректные данные automation job");
  }

  jobs.push(job);
  return job;
}
