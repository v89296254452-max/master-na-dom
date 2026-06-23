import fs from "fs";
import path from "path";
import type { VkTask } from "./vk-task-types";
import type { VkAccount, VkAccountStats, VkAccountStatus, VkAccountWithStats, VkAccountLimitStats, VkAccountAuthStatus } from "./vk-account-types";
import { DEFAULT_VK_ACCOUNT_AUTH, VK_ACCOUNT_STATUSES, VK_ACCOUNT_AUTH_STATUSES } from "./vk-account-types";
import { readVkTasksFile } from "./vk-tasks";

const VK_ACCOUNTS_PATH = path.join(process.cwd(), "data", "vk-accounts.json");
const ASSIGNMENT_TIMEZONE = "Europe/Moscow";

function getAssignmentDateKey(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleDateString("en-CA", { timeZone: ASSIGNMENT_TIMEZONE });
}

export function isAssignedToday(assignedAt: string): boolean {
  if (!assignedAt) return false;
  return getAssignmentDateKey(assignedAt) === getAssignmentDateKey();
}

export function countAccountAssignments(
  tasks: VkTask[],
  accountId: string
): Pick<VkAccountLimitStats, "assignedToday" | "assignedTotal"> {
  const assigned = tasks.filter((task) => task.assignedAccount === accountId);

  return {
    assignedTotal: assigned.length,
    assignedToday: assigned.filter((task) => isAssignedToday(task.assignedAt)).length,
  };
}

export function computeAccountLimitUsage(tasks: VkTask[], account: VkAccount): VkAccountLimitStats {
  const { assignedToday, assignedTotal } = countAccountAssignments(tasks, account.id);

  return {
    assignedToday,
    assignedTotal,
    dailyRemaining: Math.max(0, account.dailyLimit - assignedToday),
    totalRemaining: Math.max(0, account.totalLimit - assignedTotal),
  };
}

export function getAvailableTakeCount(tasks: VkTask[], account: VkAccount, requested: number): number {
  const { dailyRemaining, totalRemaining } = computeAccountLimitUsage(tasks, account);
  return Math.min(requested, dailyRemaining, totalRemaining);
}

function mapAccountStatus(value: unknown): VkAccountStatus {
  if (typeof value === "string" && VK_ACCOUNT_STATUSES.includes(value as VkAccountStatus)) {
    return value as VkAccountStatus;
  }
  return "active";
}

function toNumber(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function mapAuthStatus(value: unknown): VkAccountAuthStatus {
  if (typeof value === "string" && VK_ACCOUNT_AUTH_STATUSES.includes(value as VkAccountAuthStatus)) {
    return value as VkAccountAuthStatus;
  }
  return DEFAULT_VK_ACCOUNT_AUTH.authStatus;
}

function normalizeAccount(raw: Partial<VkAccount>): VkAccount | null {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;

  return {
    id,
    name: typeof raw.name === "string" ? raw.name.trim() : id,
    phone: typeof raw.phone === "string" ? raw.phone.trim() : "",
    status: mapAccountStatus(raw.status),
    authStatus: mapAuthStatus(raw.authStatus),
    vkUserId: typeof raw.vkUserId === "string" ? raw.vkUserId.trim() : "",
    vkProfileUrl: typeof raw.vkProfileUrl === "string" ? raw.vkProfileUrl.trim() : "",
    accessToken: typeof raw.accessToken === "string" ? raw.accessToken.trim() : "",
    tokenExpiresAt: typeof raw.tokenExpiresAt === "string" ? raw.tokenExpiresAt.trim() : "",
    lastAuthCheckAt: typeof raw.lastAuthCheckAt === "string" ? raw.lastAuthCheckAt.trim() : "",
    lastAuthError: typeof raw.lastAuthError === "string" ? raw.lastAuthError.trim() : "",
    dailyLimit: toNumber(raw.dailyLimit, 10),
    totalLimit: toNumber(raw.totalLimit, 50),
    notes: typeof raw.notes === "string" ? raw.notes.trim() : "",
  };
}

export function readVkAccountsFile(): VkAccount[] {
  if (!fs.existsSync(VK_ACCOUNTS_PATH)) {
    return [];
  }

  const content = fs.readFileSync(VK_ACCOUNTS_PATH, "utf-8");
  const parsed = JSON.parse(content) as Partial<VkAccount>[];

  if (!Array.isArray(parsed)) {
    throw new Error("data/vk-accounts.json должен содержать массив аккаунтов");
  }

  return parsed.map((item) => normalizeAccount(item)).filter((item): item is VkAccount => item !== null);
}

export function writeVkAccountsFile(accounts: VkAccount[]): void {
  fs.mkdirSync(path.dirname(VK_ACCOUNTS_PATH), { recursive: true });
  fs.writeFileSync(VK_ACCOUNTS_PATH, JSON.stringify(accounts, null, 2) + "\n", "utf-8");
}

export function ensureVkAccountsFile(): VkAccount[] {
  if (!fs.existsSync(VK_ACCOUNTS_PATH)) {
    writeVkAccountsFile([]);
    return [];
  }

  return readVkAccountsFile();
}

export function getVkAccountById(id: string, accounts?: VkAccount[]): VkAccount | undefined {
  const list = accounts ?? readVkAccountsFile();
  return list.find((account) => account.id === id);
}

export function upsertVkAccount(accounts: VkAccount[], input: VkAccount): VkAccount {
  const index = accounts.findIndex((account) => account.id === input.id);
  if (index === -1) {
    accounts.push(input);
    return input;
  }

  accounts[index] = input;
  return input;
}

export function deleteVkAccount(accounts: VkAccount[], id: string): boolean {
  const index = accounts.findIndex((account) => account.id === id);
  if (index === -1) return false;
  accounts.splice(index, 1);
  return true;
}

export function computeAccountStats(tasks: VkTask[], accountId: string): VkAccountStats {
  const assigned = tasks.filter((task) => task.assignedAccount === accountId);

  return {
    total: assigned.length,
    in_progress: assigned.filter((task) => task.status === "in_progress").length,
    need_vk_url: assigned.filter((task) => task.status === "need_vk_url").length,
    created: assigned.filter((task) => task.status === "created").length,
    filled: assigned.filter((task) => task.status === "filled").length,
    posted: assigned.filter((task) => task.status === "posted").length,
    error: assigned.filter((task) => task.status === "error").length,
  };
}

export function attachStatsToAccounts(
  accounts: VkAccount[],
  tasks: VkTask[]
): VkAccountWithStats[] {
  return accounts.map((account) => ({
    ...account,
    stats: computeAccountStats(tasks, account.id),
    limits: computeAccountLimitUsage(tasks, account),
  }));
}

export function getVkAccountsWithStats(): VkAccountWithStats[] {
  const accounts = ensureVkAccountsFile();
  const tasks = readVkTasksFile();
  return attachStatsToAccounts(accounts, tasks);
}
