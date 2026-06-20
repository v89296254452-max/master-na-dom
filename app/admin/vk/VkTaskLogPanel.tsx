"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VkAccount } from "@/lib/vk-account-types";
import type { VkTaskLogAction, VkTaskLogEntry } from "@/lib/vk-task-log-types";
import { VK_TASK_LOG_ACTIONS, VK_TASK_LOG_ACTION_LABELS } from "@/lib/vk-task-log-types";
import { VK_TASK_STATUS_LABELS } from "@/lib/vk-task-types";
import type { VkTaskStatus } from "@/lib/vk-task-types";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatStatus(value: string): string {
  if (!value) return "—";
  if (value in VK_TASK_STATUS_LABELS) {
    return VK_TASK_STATUS_LABELS[value as VkTaskStatus];
  }
  return value;
}

function formatStatusTransition(oldStatus: string, newStatus: string): string {
  if (!oldStatus && !newStatus) return "—";
  if (!oldStatus) return formatStatus(newStatus);
  if (!newStatus) return formatStatus(oldStatus);
  if (oldStatus === newStatus) return formatStatus(newStatus);
  return `${formatStatus(oldStatus)} → ${formatStatus(newStatus)}`;
}

export default function VkTaskLogPanel() {
  const [entries, setEntries] = useState<VkTaskLogEntry[]>([]);
  const [accounts, setAccounts] = useState<VkAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskIdFilter, setTaskIdFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState<"all" | VkTaskLogAction>("all");
  const [dateFilter, setDateFilter] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/vk-accounts");
      const data = await res.json();
      if (res.ok && data.success) {
        setAccounts(data.accounts as VkAccount[]);
      }
    } catch {
      // optional for filter labels
    }
  }, []);

  const loadLog = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (taskIdFilter.trim()) params.set("taskId", taskIdFilter.trim());
      if (accountFilter !== "all") params.set("accountId", accountFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (dateFilter) params.set("date", dateFilter);

      const query = params.toString();
      const res = await fetch(`/api/vk-task-log${query ? `?${query}` : ""}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить журнал");
      }

      setEntries(data.entries as VkTaskLogEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [taskIdFilter, accountFilter, actionFilter, dateFilter]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  const accountOptions = useMemo(() => {
    const ids = new Set<string>();
    accounts.forEach((account) => ids.add(account.id));
    entries.forEach((entry) => {
      if (entry.assignedAccount) ids.add(entry.assignedAccount);
    });
    return Array.from(ids).sort();
  }, [accounts, entries]);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Фильтры журнала</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-navy-muted">taskId</span>
            <input
              value={taskIdFilter}
              onChange={(e) => setTaskIdFilter(e.target.value)}
              placeholder="kp-abakan"
              className="rounded-lg border border-gray-border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-navy-muted">Аккаунт</span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-lg border border-gray-border px-3 py-2 text-sm"
            >
              <option value="all">Все</option>
              {accountOptions.map((accountId) => (
                <option key={accountId} value={accountId}>
                  {accountId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-navy-muted">action</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as "all" | VkTaskLogAction)}
              className="rounded-lg border border-gray-border px-3 py-2 text-sm"
            >
              <option value="all">Все</option>
              {VK_TASK_LOG_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {VK_TASK_LOG_ACTION_LABELS[action]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-navy-muted">Дата</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-gray-border px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            setTaskIdFilter("");
            setAccountFilter("all");
            setActionFilter("all");
            setDateFilter("");
          }}
          className="mt-4 rounded-lg border border-gray-border bg-gray-card px-4 py-2 text-sm font-medium text-navy hover:bg-white"
        >
          Сбросить фильтры
        </button>
      </section>

      <div className="overflow-x-auto rounded-xl border border-gray-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-card text-navy-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Дата / время</th>
              <th className="px-3 py-3 font-medium">action</th>
              <th className="px-3 py-3 font-medium">taskId</th>
              <th className="px-3 py-3 font-medium">account</th>
              <th className="px-3 py-3 font-medium">oldStatus → newStatus</th>
              <th className="px-3 py-3 font-medium">vkUrl</th>
              <th className="px-3 py-3 font-medium">message</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-navy-muted">
                  Загрузка журнала...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-navy-muted">
                  Событий не найдено
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-t border-gray-border align-top">
                  <td className="px-3 py-3 whitespace-nowrap text-xs">{formatDateTime(entry.createdAt)}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-gray-card px-2 py-0.5 text-xs font-medium text-navy">
                      {VK_TASK_LOG_ACTION_LABELS[entry.action]}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{entry.taskId || "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{entry.assignedAccount || "—"}</td>
                  <td className="px-3 py-3 text-xs">
                    {formatStatusTransition(entry.oldStatus, entry.newStatus)}
                  </td>
                  <td className="px-3 py-3 max-w-[200px] truncate text-xs">
                    {entry.vkUrl ? (
                      <a
                        href={entry.vkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange hover:underline"
                      >
                        {entry.vkUrl}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-navy-muted">{entry.message || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
