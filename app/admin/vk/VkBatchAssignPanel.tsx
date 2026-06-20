"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VkAccountWithStats } from "@/lib/vk-account-types";
import {
  VK_ACCOUNT_AUTH_STATUS_LABELS,
  type VkAccountAuthStatus,
} from "@/lib/vk-account-types";
import { isAccountEligibleForAssignment } from "@/lib/vk-account-auth";
import type { VkBatchAssignResult } from "@/lib/vk-batch-assign-types";
import {
  VK_BATCH_ASSIGN_STRATEGIES,
  VK_BATCH_ASSIGN_STRATEGY_LABELS,
  type VkBatchAssignStrategy,
} from "@/lib/vk-batch-assign-types";
import type { VkTask } from "@/lib/vk-task-types";
import type { VkAccountGroup } from "@/lib/vk-types";

type GroupFilter = "all" | VkAccountGroup;

const GROUP_FILTERS: { value: GroupFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "kp", label: "КП" },
  { value: "mnch", label: "МнЧ" },
  { value: "bt", label: "БТ" },
];

interface VkBatchAssignPanelProps {
  tasks: VkTask[];
  onAssigned: () => Promise<void>;
}

export default function VkBatchAssignPanel({ tasks, onAssigned }: VkBatchAssignPanelProps) {
  const [accounts, setAccounts] = useState<VkAccountWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [count, setCount] = useState(50);
  const [strategy, setStrategy] = useState<VkBatchAssignStrategy>("even");
  const [lastResult, setLastResult] = useState<VkBatchAssignResult | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vk-accounts");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить аккаунты");
      }
      setAccounts(data.accounts as VkAccountWithStats[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки аккаунтов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "active"),
    [accounts]
  );

  const eligibleAccounts = useMemo(
    () => activeAccounts.filter((account) => isAccountEligibleForAssignment(account)),
    [activeAccounts]
  );

  const newTasksCount = useMemo(() => {
    return tasks.filter((task) => {
      if (task.status !== "new") return false;
      if (groupFilter !== "all" && task.accountGroup !== groupFilter) return false;
      return true;
    }).length;
  }, [tasks, groupFilter]);

  async function handleAssign() {
    setAssigning(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-batch-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountGroup: groupFilter,
          count,
          strategy,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось распределить задачи");
      }

      setLastResult(data.result as VkBatchAssignResult);
      await onAssigned();
      await loadAccounts();

      const result = data.result as VkBatchAssignResult;
      setMessage(
        data.message ||
          `Назначено задач: ${result.assignedTotal}. Осталось new: ${result.remainingNew}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка распределения");
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
        Загрузка аккаунтов...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || message) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Пакетное распределение</h2>
        <p className="mt-1 text-sm text-navy-muted">
          Распределение задач со статусом new по active-аккаунтам с учётом лимитов
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-navy-muted">Группа</span>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as GroupFilter)}
              className="rounded-lg border border-gray-border px-3 py-2"
            >
              {GROUP_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-navy-muted">Количество задач на запуск</span>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
              className="rounded-lg border border-gray-border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-navy-muted">Стратегия</span>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as VkBatchAssignStrategy)}
              className="rounded-lg border border-gray-border px-3 py-2"
            >
              {VK_BATCH_ASSIGN_STRATEGIES.map((item) => (
                <option key={item} value={item}>
                  {VK_BATCH_ASSIGN_STRATEGY_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAssign}
            disabled={assigning || eligibleAccounts.length === 0 || newTasksCount === 0}
            className="rounded-lg bg-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-dark disabled:opacity-50"
          >
            {assigning ? "Распределение..." : "Распределить задачи"}
          </button>
          <span className="text-sm text-navy-muted">
            Доступно new: <strong className="text-navy">{newTasksCount}</strong>
          </span>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-gray-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-card text-navy-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Статус</th>
              <th className="px-3 py-3 font-medium">Авторизация</th>
              <th className="px-3 py-3 font-medium">VK User ID</th>
              <th className="px-3 py-3 font-medium">Дневной лимит</th>
              <th className="px-3 py-3 font-medium">Общий лимит</th>
              <th className="px-3 py-3 font-medium">Назначено всего</th>
              <th className="px-3 py-3 font-medium">Сегодня</th>
              <th className="px-3 py-3 font-medium">Доступный остаток</th>
            </tr>
          </thead>
          <tbody>
            {activeAccounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-navy-muted">
                  Нет active-аккаунтов
                </td>
              </tr>
            ) : (
              activeAccounts.map((account) => {
                const available = Math.min(
                  account.limits.dailyRemaining,
                  account.limits.totalRemaining
                );
                const canAssign = isAccountEligibleForAssignment(account);

                return (
                  <tr key={account.id} className="border-t border-gray-border">
                    <td className="px-3 py-3">
                      <div className="font-medium text-navy">{account.name}</div>
                      <div className="font-mono text-xs text-navy-muted">{account.id}</div>
                    </td>
                    <td className="px-3 py-3">{account.status}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                          account.authStatus === "connected"
                            ? "bg-emerald-100 text-emerald-800"
                            : account.authStatus === "error" || account.authStatus === "expired"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {VK_ACCOUNT_AUTH_STATUS_LABELS[account.authStatus]}
                      </span>
                      {!canAssign ? (
                        <div className="mt-1 text-xs text-amber-700">Не участвует в выдаче</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{account.vkUserId || "—"}</td>
                    <td className="px-3 py-3">{account.dailyLimit}</td>
                    <td className="px-3 py-3">{account.totalLimit}</td>
                    <td className="px-3 py-3">{account.limits.assignedTotal}</td>
                    <td className="px-3 py-3">{account.limits.assignedToday}</td>
                    <td className="px-3 py-3 font-semibold text-navy">{available}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {lastResult ? (
        <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
          <h3 className="text-base font-semibold text-navy">Результат последнего распределения</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-card px-3 py-2">
              <div className="text-xs text-navy-muted">Назначено</div>
              <div className="text-xl font-bold text-navy">{lastResult.assignedTotal}</div>
            </div>
            <div className="rounded-lg bg-gray-card px-3 py-2">
              <div className="text-xs text-navy-muted">Осталось new</div>
              <div className="text-xl font-bold text-navy">{lastResult.remainingNew}</div>
            </div>
            <div className="rounded-lg bg-gray-card px-3 py-2">
              <div className="text-xs text-navy-muted">Аккаунтов задействовано</div>
              <div className="text-xl font-bold text-navy">{lastResult.byAccount.length}</div>
            </div>
          </div>

          {lastResult.byAccount.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-card text-navy-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Аккаунт</th>
                    <th className="px-3 py-2 font-medium">Получено задач</th>
                  </tr>
                </thead>
                <tbody>
                  {lastResult.byAccount.map((row) => (
                    <tr key={row.accountId} className="border-t border-gray-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.accountName}</div>
                        <div className="font-mono text-xs text-navy-muted">{row.accountId}</div>
                      </td>
                      <td className="px-3 py-2 font-semibold">{row.assigned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
