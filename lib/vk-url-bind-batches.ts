import fs from "fs";
import path from "path";
import type { VkUrlBindMode } from "./vk-url-bind";

const VK_URL_BIND_BATCHES_PATH = path.join(process.cwd(), "data", "vk-url-bind-batches.json");

export interface VkUrlBindBatch {
  batchId: string;
  createdAt: string;
  accountId: string;
  mode: VkUrlBindMode;
  linksTotal: number;
  tasksUpdated: number;
  taskIds: string[];
}

export function createBindBatchId(timestamp = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(timestamp);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `bind_${get("year")}${get("month")}${get("day")}_${get("hour")}${get("minute")}${get("second")}`;
}

function normalizeBatch(raw: Partial<VkUrlBindBatch>): VkUrlBindBatch | null {
  const batchId = typeof raw.batchId === "string" ? raw.batchId.trim() : "";
  const accountId = typeof raw.accountId === "string" ? raw.accountId.trim() : "";

  if (!batchId || !accountId) {
    return null;
  }

  const mode: VkUrlBindMode = raw.mode === "auto" ? "auto" : "need_vk_url";
  const taskIds = Array.isArray(raw.taskIds)
    ? raw.taskIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  return {
    batchId,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    accountId,
    mode,
    linksTotal: typeof raw.linksTotal === "number" && raw.linksTotal >= 0 ? raw.linksTotal : taskIds.length,
    tasksUpdated:
      typeof raw.tasksUpdated === "number" && raw.tasksUpdated >= 0 ? raw.tasksUpdated : taskIds.length,
    taskIds,
  };
}

export function readVkUrlBindBatchesFile(): VkUrlBindBatch[] {
  if (!fs.existsSync(VK_URL_BIND_BATCHES_PATH)) {
    return [];
  }

  const content = fs.readFileSync(VK_URL_BIND_BATCHES_PATH, "utf-8");
  const parsed = JSON.parse(content) as Partial<VkUrlBindBatch>[];

  if (!Array.isArray(parsed)) {
    throw new Error("data/vk-url-bind-batches.json должен содержать массив batches");
  }

  return parsed.map((item) => normalizeBatch(item)).filter((item): item is VkUrlBindBatch => item !== null);
}

export function writeVkUrlBindBatchesFile(batches: VkUrlBindBatch[]): void {
  fs.mkdirSync(path.dirname(VK_URL_BIND_BATCHES_PATH), { recursive: true });
  fs.writeFileSync(VK_URL_BIND_BATCHES_PATH, JSON.stringify(batches, null, 2) + "\n", "utf-8");
}

export function appendVkUrlBindBatch(batch: VkUrlBindBatch, limit = 10): VkUrlBindBatch[] {
  const existing = readVkUrlBindBatchesFile().filter((item) => item.batchId !== batch.batchId);
  const next = [batch, ...existing].slice(0, limit);
  writeVkUrlBindBatchesFile(next);
  return next;
}

export function getRecentVkUrlBindBatches(limit = 10): VkUrlBindBatch[] {
  return readVkUrlBindBatchesFile()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getVkUrlBindBatchById(batchId: string): VkUrlBindBatch | undefined {
  const normalized = batchId.trim();
  if (!normalized) return undefined;
  return readVkUrlBindBatchesFile().find((batch) => batch.batchId === normalized);
}

export function getLatestVkUrlBindBatch(): VkUrlBindBatch | undefined {
  return getRecentVkUrlBindBatches(1)[0];
}
