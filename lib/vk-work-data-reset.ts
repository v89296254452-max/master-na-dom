import fs from "fs";
import path from "path";
import type { VkAccount } from "./vk-account-types";
import { readVkAccountsFile, writeVkAccountsFile } from "./vk-accounts";
import { writeVkAutomationQueueFile } from "./vk-automation-queue";
import { normalizeImageAssets } from "./vk-image-assets-types";
import { DEFAULT_MANUAL_SETUP } from "./vk-manual-setup";
import { readVkTaskLogFile, writeVkTaskLogFile } from "./vk-task-log";
import type { VkTask } from "./vk-task-types";
import { readVkTasksFile, writeVkTasksFile } from "./vk-tasks";
import { writeVkUrlBindBatchesFile } from "./vk-url-bind-batches";
import { VK_WORK_DATA_KEEP_ACCOUNT_IDS } from "./vk-work-data-reset-constants";

export { VK_WORK_DATA_KEEP_ACCOUNT_IDS };

const VK_BIND_BATCHES_LEGACY_PATH = path.join(process.cwd(), "data", "vk-bind-batches.json");
const VK_URL_BIND_BATCHES_PATH = path.join(process.cwd(), "data", "vk-url-bind-batches.json");

export interface VkWorkDataResetResult {
  accountsKept: number;
  accountsRemoved: number;
  tasksReset: number;
  queueCleared: boolean;
  logCleared: boolean;
  bindBatchesCleared: boolean;
  warning: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function resetTaskWorkFields(task: VkTask, timestamp: string): VkTask {
  const imageAssets = normalizeImageAssets(task.imageAssets);

  return {
    ...task,
    status: "new",
    assignedAccount: "",
    assignedAt: "",
    vkUrl: "",
    vkGroupId: "",
    manualCreated: false,
    manualSetup: { ...DEFAULT_MANUAL_SETUP },
    lastBindBatchId: "",
    imageAssets: {
      ...imageAssets,
      avatarPath: "",
      coverPath: "",
      postImagePaths: [],
    },
    updatedAt: timestamp,
  };
}

function filterAccounts(accounts: VkAccount[]): {
  kept: VkAccount[];
  removed: number;
} {
  const keepSet = new Set<string>(VK_WORK_DATA_KEEP_ACCOUNT_IDS);
  const kept = accounts.filter((account) => keepSet.has(account.id));
  const removed = accounts.length - kept.length;

  kept.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  return { kept, removed };
}

function clearBindBatchFiles(): boolean {
  let cleared = false;

  if (fs.existsSync(VK_URL_BIND_BATCHES_PATH)) {
    writeVkUrlBindBatchesFile([]);
    cleared = true;
  }

  if (fs.existsSync(VK_BIND_BATCHES_LEGACY_PATH)) {
    fs.writeFileSync(VK_BIND_BATCHES_LEGACY_PATH, "[]\n", "utf-8");
    cleared = true;
  }

  return cleared;
}

export function resetWorkData(): VkWorkDataResetResult {
  const timestamp = nowIso();

  const allAccounts = readVkAccountsFile();
  const { kept, removed } = filterAccounts(allAccounts);
  writeVkAccountsFile(kept);

  const tasks = readVkTasksFile();
  const resetTasks = tasks.map((task) => resetTaskWorkFields(task, timestamp));
  writeVkTasksFile(resetTasks);

  writeVkAutomationQueueFile([]);

  if (readVkTaskLogFile().length > 0 || fs.existsSync(path.join(process.cwd(), "data", "vk-task-log.json"))) {
    writeVkTaskLogFile([]);
  }

  const bindBatchesCleared = clearBindBatchFiles();

  const warning = kept.length < VK_WORK_DATA_KEEP_ACCOUNT_IDS.length
    ? `После очистки осталось ${kept.length} аккаунтов (ожидалось ${VK_WORK_DATA_KEEP_ACCOUNT_IDS.length}). Проверьте data/vk-accounts.json.`
    : null;

  return {
    accountsKept: kept.length,
    accountsRemoved: removed,
    tasksReset: resetTasks.length,
    queueCleared: true,
    logCleared: true,
    bindBatchesCleared,
    warning,
  };
}
