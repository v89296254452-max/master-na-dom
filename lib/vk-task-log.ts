import fs from "fs";
import path from "path";
import type { VkTaskLogEntry, VkTaskLogFilters, VkTaskLogInput } from "./vk-task-log-types";
import { VK_TASK_LOG_ACTIONS } from "./vk-task-log-types";

const VK_TASK_LOG_PATH = path.join(process.cwd(), "data", "vk-task-log.json");
const LOG_TIMEZONE = "Europe/Moscow";

function nowIso(): string {
  return new Date().toISOString();
}

function createLogId(index = 0): string {
  return `log_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeEntry(raw: Partial<VkTaskLogEntry>): VkTaskLogEntry | null {
  const action = raw.action;
  if (typeof action !== "string" || !VK_TASK_LOG_ACTIONS.includes(action as VkTaskLogEntry["action"])) {
    return null;
  }

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createLogId();
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt : nowIso();

  return {
    id,
    taskId: typeof raw.taskId === "string" ? raw.taskId : "",
    action: action as VkTaskLogEntry["action"],
    oldStatus: typeof raw.oldStatus === "string" ? raw.oldStatus : "",
    newStatus: typeof raw.newStatus === "string" ? raw.newStatus : "",
    assignedAccount: typeof raw.assignedAccount === "string" ? raw.assignedAccount : "",
    vkUrl: typeof raw.vkUrl === "string" ? raw.vkUrl : "",
    vkGroupId: typeof raw.vkGroupId === "string" ? raw.vkGroupId : "",
    message: typeof raw.message === "string" ? raw.message : "",
    createdAt,
  };
}

export function readVkTaskLogFile(): VkTaskLogEntry[] {
  if (!fs.existsSync(VK_TASK_LOG_PATH)) {
    return [];
  }

  const content = fs.readFileSync(VK_TASK_LOG_PATH, "utf-8");
  const parsed = JSON.parse(content) as Partial<VkTaskLogEntry>[];

  if (!Array.isArray(parsed)) {
    throw new Error("data/vk-task-log.json должен содержать массив событий");
  }

  return parsed
    .map((item) => normalizeEntry(item))
    .filter((item): item is VkTaskLogEntry => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function writeVkTaskLogFile(entries: VkTaskLogEntry[]): void {
  fs.mkdirSync(path.dirname(VK_TASK_LOG_PATH), { recursive: true });
  fs.writeFileSync(VK_TASK_LOG_PATH, JSON.stringify(entries, null, 2) + "\n", "utf-8");
}

export function ensureVkTaskLogFile(): VkTaskLogEntry[] {
  if (!fs.existsSync(VK_TASK_LOG_PATH)) {
    writeVkTaskLogFile([]);
    return [];
  }

  return readVkTaskLogFile();
}

function getLogDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: LOG_TIMEZONE });
}

export function filterVkTaskLog(entries: VkTaskLogEntry[], filters: VkTaskLogFilters): VkTaskLogEntry[] {
  return entries.filter((entry) => {
    if (filters.taskId && entry.taskId !== filters.taskId) return false;
    if (filters.accountId && entry.assignedAccount !== filters.accountId) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.date && getLogDateKey(entry.createdAt) !== filters.date) return false;
    return true;
  });
}

export function appendVkTaskLogEntries(inputs: VkTaskLogInput[]): VkTaskLogEntry[] {
  const log = ensureVkTaskLogFile();
  const timestamp = nowIso();

  const created = inputs.map((input, index) => ({
    id: createLogId(index),
    createdAt: timestamp,
    taskId: input.taskId,
    action: input.action,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    assignedAccount: input.assignedAccount,
    vkUrl: input.vkUrl,
    vkGroupId: input.vkGroupId,
    message: input.message,
  }));

  writeVkTaskLogFile([...created, ...log]);
  return created;
}

export function appendVkTaskLogEntry(input: VkTaskLogInput): VkTaskLogEntry {
  return appendVkTaskLogEntries([input])[0];
}
