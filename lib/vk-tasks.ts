import fs from "fs";
import path from "path";
import type { VkPlanRow } from "./vk-types";
import type { VkTask, VkTaskStatus } from "./vk-task-types";
import { DEFAULT_QUALITY_CHECK, normalizeQualityCheck } from "./vk-quality-check";
import { generateVkContentPack, resolveContentPackFromFiles } from "./vk-content-pack-server";
import { DEFAULT_VK_TASK_IMAGE_ASSETS, normalizeImageAssets } from "./vk-image-assets-types";
import { DEFAULT_MANUAL_SETUP, normalizeManualSetup } from "./vk-manual-setup";
import { loadVkPlanStrict } from "./vk-plan";

const VK_TASKS_PATH = path.join(process.cwd(), "data", "vk-tasks.json");

function nowIso(): string {
  return new Date().toISOString();
}

function mapPlanStatus(status: string): VkTaskStatus {
  const normalized = status.trim().toLowerCase();

  if (normalized === "new" || normalized === "pending") return "new";
  if (normalized === "in_progress" || normalized === "in-progress") return "in_progress";
  if (normalized === "need_vk_url" || normalized === "need-vk-url") return "need_vk_url";
  if (normalized === "ready_for_worker" || normalized === "ready-for-worker") return "ready_for_worker";
  if (normalized === "created") return "created";
  if (normalized === "filled") return "filled";
  if (normalized === "posted" || normalized === "done") return "posted";
  if (normalized === "error" || normalized === "failed") return "error";

  return "new";
}

export function planRowToTask(row: VkPlanRow, timestamp = nowIso()): VkTask {
  const contentPackInput = {
    accountGroup: row.accountGroup,
    city: row.city,
    service: row.service,
    phone: row.phone,
    siteUrl: row.siteUrl,
    vkName: row.vkName,
    vkFirstPost: row.vkFirstPost,
    slug: row.slug,
  };

  return {
    id: row.slug,
    accountGroup: row.accountGroup,
    city: row.city,
    service: row.service,
    slug: row.slug,
    phone: row.phone,
    siteUrl: row.siteUrl,
    vkName: row.vkName,
    vkDescription: row.vkDescription,
    vkStatus: row.vkStatus,
    vkFirstPost: row.vkFirstPost,
    vkKeywords: row.vkKeywords,
    vkUrl: "",
    vkGroupId: "",
    assignedAccount: "",
    assignedAt: "",
    manualCreated: false,
    lastBindBatchId: "",
    qualityCheck: { ...DEFAULT_QUALITY_CHECK },
    manualSetup: { ...DEFAULT_MANUAL_SETUP },
    contentPack: generateVkContentPack(contentPackInput),
    imageAssets: { ...DEFAULT_VK_TASK_IMAGE_ASSETS },
    status: mapPlanStatus(row.status),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeTask(raw: Partial<VkTask>): VkTask | null {
  if (!raw.id || !raw.slug) return null;

  const timestamp = nowIso();
  const accountGroup = raw.accountGroup ?? "mnch";
  const contentPackInput = {
    accountGroup,
    city: raw.city ?? "",
    service: raw.service ?? "",
    phone: raw.phone ?? "",
    siteUrl: raw.siteUrl ?? "",
    vkName: raw.vkName ?? "",
    vkFirstPost: raw.vkFirstPost ?? "",
    slug: raw.slug ?? raw.id ?? "",
  };

  return {
    id: raw.id,
    accountGroup,
    city: raw.city ?? "",
    service: raw.service ?? "",
    slug: raw.slug,
    phone: raw.phone ?? "",
    siteUrl: raw.siteUrl ?? "",
    vkName: raw.vkName ?? "",
    vkDescription: raw.vkDescription ?? "",
    vkStatus: raw.vkStatus ?? "",
    vkFirstPost: raw.vkFirstPost ?? "",
    vkKeywords: raw.vkKeywords ?? "",
    vkUrl: raw.vkUrl ?? "",
    vkGroupId: raw.vkGroupId ?? "",
    assignedAccount: raw.assignedAccount ?? "",
    assignedAt: raw.assignedAt ?? "",
    manualCreated: raw.manualCreated === true,
    lastBindBatchId: typeof raw.lastBindBatchId === "string" ? raw.lastBindBatchId : "",
    qualityCheck: normalizeQualityCheck(raw.qualityCheck),
    manualSetup: normalizeManualSetup(raw.manualSetup),
    contentPack: resolveContentPackFromFiles(raw.contentPack, contentPackInput),
    imageAssets: normalizeImageAssets(raw.imageAssets),
    status: mapPlanStatus(raw.status ?? "new"),
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
  };
}

export function readVkTasksFile(): VkTask[] {
  if (!fs.existsSync(VK_TASKS_PATH)) {
    return [];
  }

  const content = fs.readFileSync(VK_TASKS_PATH, "utf-8");
  const parsed = JSON.parse(content) as Partial<VkTask>[];

  if (!Array.isArray(parsed)) {
    throw new Error("data/vk-tasks.json должен содержать массив задач");
  }

  return parsed.map((item) => normalizeTask(item)).filter((item): item is VkTask => item !== null);
}

export function writeVkTasksFile(tasks: VkTask[]): void {
  fs.mkdirSync(path.dirname(VK_TASKS_PATH), { recursive: true });
  fs.writeFileSync(VK_TASKS_PATH, JSON.stringify(tasks, null, 2) + "\n", "utf-8");
}

export function createVkTasksFromPlan(): VkTask[] {
  const plan = loadVkPlanStrict();
  if (!plan.ok) {
    throw new Error(plan.error);
  }

  const timestamp = nowIso();
  return plan.rows.map((row) => planRowToTask(row, timestamp));
}

export function ensureVkTasksFile(): VkTask[] {
  if (fs.existsSync(VK_TASKS_PATH)) {
    return readVkTasksFile();
  }

  const tasks = createVkTasksFromPlan();
  writeVkTasksFile(tasks);
  return tasks;
}

export function getVkTasksPath(): string {
  return VK_TASKS_PATH;
}

export function updateVkTask(
  tasks: VkTask[],
  id: string,
  patch: Partial<
    Pick<
      VkTask,
      | "vkUrl"
      | "vkGroupId"
      | "assignedAccount"
      | "assignedAt"
      | "status"
      | "qualityCheck"
      | "manualSetup"
      | "contentPack"
      | "imageAssets"
      | "manualCreated"
      | "lastBindBatchId"
    >
  >
): VkTask | null {
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;

  const updated: VkTask = {
    ...tasks[index],
    ...patch,
    qualityCheck: patch.qualityCheck ?? tasks[index].qualityCheck,
    manualSetup: patch.manualSetup ?? tasks[index].manualSetup,
    contentPack: patch.contentPack ?? tasks[index].contentPack,
    imageAssets: patch.imageAssets ?? tasks[index].imageAssets,
    updatedAt: nowIso(),
  };

  tasks[index] = updated;
  return updated;
}

export interface VkTaskBulkUpdate {
  id: string;
  vkUrl?: string;
  vkGroupId?: string;
  assignedAccount?: string;
  status?: VkTaskStatus;
}

export function bulkUpdateVkTasks(
  tasks: VkTask[],
  updates: VkTaskBulkUpdate[]
): { updated: number; notFound: string[] } {
  const notFound: string[] = [];
  let updated = 0;

  for (const item of updates) {
    const id = item.id.trim();
    if (!id) continue;

    const patch: Partial<
      Pick<VkTask, "vkUrl" | "vkGroupId" | "assignedAccount" | "status" | "manualCreated">
    > = {};

    if (item.vkUrl !== undefined) patch.vkUrl = item.vkUrl;
    if (item.vkGroupId !== undefined) patch.vkGroupId = item.vkGroupId;
    if (item.assignedAccount !== undefined) patch.assignedAccount = item.assignedAccount;
    if (item.status !== undefined) patch.status = item.status;

    if (patch.vkGroupId?.trim()) {
      patch.manualCreated = true;
    }

    if (Object.keys(patch).length === 0) continue;

    const result = updateVkTask(tasks, id, patch);
    if (!result) {
      notFound.push(id);
    } else {
      updated += 1;
    }
  }

  return { updated, notFound };
}

export function takeVkTasks(
  tasks: VkTask[],
  options: {
    accountGroup?: VkTask["accountGroup"] | "all";
    count?: number;
    assignedAccount?: string;
    assignedAt?: string;
  } = {}
): VkTask[] {
  const count = options.count ?? 10;
  const taken: VkTask[] = [];
  const assignedAt = options.assignedAt ?? nowIso();

  for (const task of tasks) {
    if (taken.length >= count) break;
    if (task.status !== "new") continue;
    if (options.accountGroup && options.accountGroup !== "all" && task.accountGroup !== options.accountGroup) {
      continue;
    }

    const patch: Partial<Pick<VkTask, "status" | "assignedAccount" | "assignedAt">> = {
      status: "need_vk_url",
      assignedAt,
    };

    if (options.assignedAccount) {
      patch.assignedAccount = options.assignedAccount;
    }

    const updated = updateVkTask(tasks, task.id, patch);
    if (updated) taken.push(updated);
  }

  return taken;
}
