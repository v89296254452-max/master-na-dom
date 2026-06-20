import fs from "fs";
import path from "path";
import type {
  VkAutomationAction,
  VkAutomationJob,
  VkAutomationJobCompleteInput,
  VkAutomationJobStatus,
} from "./vk-automation-queue-types";
import { VK_AUTOMATION_ACTIONS } from "./vk-automation-queue-types";
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
  return value === "pending" || value === "running" || value === "success" || value === "failed";
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
