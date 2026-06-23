import type { VkAccountWithStats } from "./vk-account-types";
import type { VkTask, VkTaskStatus } from "./vk-task-types";
import { VK_QUALITY_CHECK_KEYS } from "./vk-quality-check";
import { VK_CONTENT_PACK_KEYS } from "./vk-content-pack";
import type { VkAccountGroup } from "./vk-types";

const GROUP_ORDER: VkAccountGroup[] = ["kp", "mnch", "bt"];

export const TASK_CSV_HEADERS = [
  "id",
  "group",
  "city",
  "service",
  "slug",
  "siteUrl",
  "phone",
  "vkName",
  "vkUrl",
  "vkGroupId",
  "assignedAccount",
  "status",
  "assignedAt",
  "updatedAt",
  ...VK_QUALITY_CHECK_KEYS,
  ...VK_CONTENT_PACK_KEYS,
] as const;

export const ACCOUNT_CSV_HEADERS = [
  "accountId",
  "name",
  "phone",
  "status",
  "dailyLimit",
  "totalLimit",
  "assigned",
  "created",
  "filled",
  "posted",
  "error",
] as const;

export const GROUP_CSV_HEADERS = [
  "group",
  "total",
  "new",
  "in_progress",
  "need_vk_url",
  "created",
  "ready_for_worker",
  "filled",
  "posted",
  "error",
  "progressPercent",
] as const;

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? "");
  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: readonly string[], rows: (string | number)[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(";"),
    ...rows.map((row) => row.map(escapeCsvCell).join(";")),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatExportDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function taskToCsvRow(task: VkTask): (string | number)[] {
  return [
    task.id,
    task.accountGroup,
    task.city,
    task.service,
    task.slug,
    task.siteUrl,
    task.phone,
    task.vkName,
    task.vkUrl,
    task.vkGroupId,
    task.assignedAccount,
    task.status,
    task.assignedAt,
    task.updatedAt,
    ...VK_QUALITY_CHECK_KEYS.map((key) => (task.qualityCheck[key] ? 1 : 0)),
    ...VK_CONTENT_PACK_KEYS.map((key) => task.contentPack[key]),
  ];
}

function countByStatus(tasks: VkTask[]): Record<VkTaskStatus, number> {
  const counts: Record<VkTaskStatus, number> = {
    new: 0,
    in_progress: 0,
    need_vk_url: 0,
    created: 0,
    ready_for_worker: 0,
    filled: 0,
    posted: 0,
    error: 0,
  };

  for (const task of tasks) {
    counts[task.status] += 1;
  }

  return counts;
}

function calcProgressPercent(posted: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((posted / total) * 1000) / 10;
}

export function buildTasksCsv(tasks: VkTask[]): string {
  return buildCsv(TASK_CSV_HEADERS, tasks.map(taskToCsvRow));
}

export function buildPostedTasksCsv(tasks: VkTask[]): string {
  const posted = tasks.filter((task) => task.status === "posted");
  return buildCsv(TASK_CSV_HEADERS, posted.map(taskToCsvRow));
}

export function buildErrorTasksCsv(tasks: VkTask[]): string {
  const errors = tasks.filter((task) => task.status === "error");
  return buildCsv(TASK_CSV_HEADERS, errors.map(taskToCsvRow));
}

export function buildAccountReportRows(
  tasks: VkTask[],
  accounts: VkAccountWithStats[]
): (string | number)[][] {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const accountIds = new Set<string>(accountMap.keys());

  for (const task of tasks) {
    if (task.assignedAccount) {
      accountIds.add(task.assignedAccount);
    }
  }

  return Array.from(accountIds)
    .sort()
    .map((accountId) => {
      const account = accountMap.get(accountId);
      const accountTasks = tasks.filter((task) => task.assignedAccount === accountId);
      const counts = countByStatus(accountTasks);

      return [
        accountId,
        account?.name ?? accountId,
        account?.phone ?? "",
        account?.status ?? "",
        account?.dailyLimit ?? "",
        account?.totalLimit ?? "",
        accountTasks.length,
        counts.created,
        counts.filled,
        counts.posted,
        counts.error,
      ];
    });
}

export function buildAccountsCsv(tasks: VkTask[], accounts: VkAccountWithStats[]): string {
  return buildCsv(ACCOUNT_CSV_HEADERS, buildAccountReportRows(tasks, accounts));
}

export function buildGroupReportRows(tasks: VkTask[]): (string | number)[][] {
  return GROUP_ORDER.map((group) => {
    const groupTasks = tasks.filter((task) => task.accountGroup === group);
    const counts = countByStatus(groupTasks);
    const total = groupTasks.length;

    return [
      group,
      total,
      counts.new,
      counts.in_progress,
      counts.need_vk_url,
      counts.created,
      counts.ready_for_worker,
      counts.filled,
      counts.posted,
      counts.error,
      calcProgressPercent(counts.posted, total),
    ];
  });
}

export function buildGroupsCsv(tasks: VkTask[]): string {
  return buildCsv(GROUP_CSV_HEADERS, buildGroupReportRows(tasks));
}
