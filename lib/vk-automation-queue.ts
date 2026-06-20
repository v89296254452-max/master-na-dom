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
import { isAccountEligibleForAssignment } from "./vk-account-auth";
import { getVkAccountById, readVkAccountsFile } from "./vk-accounts";
import { appendVkTaskLogEntry } from "./vk-task-log";
import type { VkTaskStatus } from "./vk-task-types";
import { VK_TASK_STATUSES } from "./vk-task-types";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "./vk-tasks";

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

export function getRecentAutomationJobs(jobs: VkAutomationJob[], limit = 100): VkAutomationJob[] {
  return [...jobs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

const AUTOMATION_PIPELINE: Array<{ action: VkAutomationAction; payload?: Record<string, unknown> }> = [
  { action: "login_account" },
  { action: "create_group" },
  { action: "fill_description" },
  { action: "upload_avatar" },
  { action: "upload_cover" },
  { action: "publish_pinned_post" },
  { action: "publish_post", payload: { postKey: "post2" } },
  { action: "publish_post", payload: { postKey: "post3" } },
  { action: "publish_post", payload: { postKey: "post4" } },
  { action: "publish_post", payload: { postKey: "post5" } },
  { action: "save_result", payload: { taskStatus: "created" } },
];

function pipelineJobId(taskId: string, action: VkAutomationAction, payload?: Record<string, unknown>): string {
  const postKey = typeof payload?.postKey === "string" ? payload.postKey : "";
  return `${taskId}::${action}${postKey ? `::${postKey}` : ""}`;
}

function hasActivePipelineJob(jobs: VkAutomationJob[], jobId: string): boolean {
  return jobs.some(
    (job) =>
      job.id === jobId &&
      (job.status === "pending" || job.status === "running" || job.status === "success")
  );
}

function createSkippedJob(
  taskId: string,
  accountId: string,
  reason: string,
  timestamp: string
): VkAutomationJob {
  return {
    id: `skip-${taskId}-${timestamp}`,
    taskId,
    accountId: accountId || "—",
    action: "save_result",
    status: "skipped",
    payload: {},
    result: {},
    error: reason,
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: "",
    completedAt: timestamp,
  };
}

function getInProgressTasks(tasks: ReturnType<typeof readVkTasksFile>, taskIds?: string[]) {
  let filtered = tasks.filter((task) => task.status === "in_progress");

  if (taskIds && taskIds.length > 0) {
    const idSet = new Set(taskIds);
    filtered = filtered.filter((task) => idSet.has(task.id));
  }

  return filtered;
}

function appendPipelineJobsForTask(
  jobs: VkAutomationJob[],
  task: { id: string; assignedAccount: string },
  accountId: string,
  timestamp: string
): number {
  let taskJobsCreated = 0;

  for (const step of AUTOMATION_PIPELINE) {
    const jobId = pipelineJobId(task.id, step.action, step.payload);
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
    const accountId = task.assignedAccount.trim();

    if (!accountId) {
      errors.push(`${task.id}: не назначен assignedAccount`);
      continue;
    }

    const account = getVkAccountById(accountId, accounts);
    if (!account) {
      errors.push(`${task.id}: аккаунт "${accountId}" не найден`);
      continue;
    }

    if (!isAccountEligibleForAssignment(account)) {
      jobs.push(
        createSkippedJob(task.id, accountId, "Аккаунт не active или authStatus !== connected", timestamp)
      );
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

export function recreateAutomationQueue(taskIds?: string[]): VkAutomationGenerateResult {
  const tasks = readVkTasksFile();
  const accounts = readVkAccountsFile();
  const targetTasks = getInProgressTasks(tasks, taskIds);
  const targetTaskIdSet = new Set(targetTasks.map((task) => task.id));
  const errors: string[] = [];

  if (targetTasks.length === 0) {
    return {
      created: 0,
      skipped: 0,
      removed: 0,
      errors: taskIds?.length
        ? ["Нет in_progress задач для указанных taskId"]
        : ["Нет in_progress задач для пересоздания очереди"],
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

  const { created, skipped } = generateJobsForTasks(jobs, targetTasks, accounts, errors);
  writeVkAutomationQueueFile(jobs);

  return {
    created,
    skipped,
    removed,
    errors,
    stats: computeAutomationQueueStats(jobs),
  };
}

export function generateAutomationQueue(): VkAutomationGenerateResult {
  const jobs = readVkAutomationQueueFile();
  const accounts = readVkAccountsFile();
  const tasks = readVkTasksFile();
  const targetTasks = getInProgressTasks(tasks);
  const errors: string[] = [];

  const { created, skipped } = generateJobsForTasks(jobs, targetTasks, accounts, errors);
  writeVkAutomationQueueFile(jobs);

  return {
    created,
    skipped,
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
  const taskStatus = isTaskStatus(result.taskStatus) ? result.taskStatus : "created";

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

export function claimNextPendingAutomationJob(jobs: VkAutomationJob[]): VkAutomationJob | null {
  const index = jobs.findIndex((job) => job.status === "pending");

  if (index === -1) {
    return null;
  }

  const timestamp = nowIso();
  const claimed: VkAutomationJob = {
    ...jobs[index],
    status: "running",
    attempts: jobs[index].attempts + 1,
    startedAt: timestamp,
    updatedAt: timestamp,
    error: "",
  };

  jobs[index] = claimed;
  return claimed;
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

  const status: VkAutomationJobStatus = input.status === "failed" ? "failed" : "success";

  const updated: VkAutomationJob = {
    ...job,
    status,
    result: input.result ? normalizeRecord(input.result) : job.result,
    error: input.status === "failed" ? (input.error?.trim() || "Automation failed") : "",
    updatedAt: timestamp,
    completedAt: timestamp,
  };

  jobs[index] = updated;

  if (updated.action === "save_result" && status === "success") {
    applySaveResultToTask(updated, updated.result);
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
