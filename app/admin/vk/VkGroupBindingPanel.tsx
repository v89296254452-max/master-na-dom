"use client";

import { useMemo, useState } from "react";
import type { VkAccountWithStats } from "@/lib/vk-account-types";
import type { VkTask } from "@/lib/vk-task-types";
import { VK_TASK_STATUS_LABELS } from "@/lib/vk-task-types";

interface VkGroupBindingCheck {
  taskId: string;
  vkGroupId: string;
  groupName: string;
  displayUrl: string;
  isAdmin: boolean;
  canPost: boolean;
  canEdit: boolean;
  error: string;
}

interface VkGroupBindingPanelProps {
  tasks: VkTask[];
  accounts: VkAccountWithStats[];
  onTasksUpdated?: () => void | Promise<void>;
}

function boolLabel(value: boolean): string {
  return value ? "да" : "нет";
}

export default function VkGroupBindingPanel({
  tasks,
  accounts,
  onTasksUpdated,
}: VkGroupBindingPanelProps) {
  const [accountFilter, setAccountFilter] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkAccountId, setBulkAccountId] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [checkByTaskId, setCheckByTaskId] = useState<Record<string, VkGroupBindingCheck>>({});

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.status === "active" || account.status === "paused")
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    [accounts]
  );

  const bindingTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (!task.assignedAccount.trim()) return false;
        if (accountFilter && task.assignedAccount !== accountFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const aTime = a.assignedAt || a.updatedAt || a.createdAt;
        const bTime = b.assignedAt || b.updatedAt || b.createdAt;
        const byTime = aTime.localeCompare(bTime);
        if (byTime !== 0) return byTime;
        return a.id.localeCompare(b.id);
      });
  }, [tasks, accountFilter]);

  async function handleUpdateUrl(task: VkTask) {
    const urlInput = window.prompt(
      `Обновить URL для ${task.id}\n\nВставьте ссылку (club/public/screen_name):`,
      task.vkUrl || ""
    );

    if (!urlInput?.trim()) return;

    setBusyTaskId(task.id);
    setError(null);

    try {
      const res = await fetch("/api/vk-tasks/update-group-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          urlInput: urlInput.trim(),
          accountId: task.assignedAccount,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось обновить URL");
      }

      await onTasksUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка обновления URL");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleCheckGroup(task: VkTask) {
    setBusyTaskId(task.id);
    setError(null);

    try {
      const res = await fetch("/api/vk-tasks/check-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          accountId: task.assignedAccount,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Не удалось проверить группу");
      }

      if (data.check) {
        setCheckByTaskId((prev) => ({ ...prev, [task.id]: data.check as VkGroupBindingCheck }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка проверки группы");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleBulkUpdate() {
    const accountId = bulkAccountId.trim();
    if (!accountId) {
      setError("Выберите аккаунт для массового обновления");
      return;
    }
    if (!bulkText.trim()) {
      setError("Вставьте ссылки для массового обновления");
      return;
    }

    setBulkBusy(true);
    setError(null);
    setBulkResult(null);

    try {
      const res = await fetch("/api/vk-tasks/bulk-update-group-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          text: bulkText,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось выполнить массовое обновление");
      }

      setBulkResult(
        [
          `Обновлено задач: ${data.tasksUpdated ?? 0}`,
          data.notAssigned?.length ? `Без задачи: ${data.notAssigned.length}` : "",
          data.notRecognized?.length ? `Не распознано: ${data.notRecognized.length}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      );

      await onTasksUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка массового обновления");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Привязка групп</h2>
        <p className="mt-1 text-sm text-navy-muted">
          vkGroupId — главный идентификатор. URL используется только для отображения и может меняться во ВКонтакте.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-navy-muted">Фильтр по аккаунту</span>
            <select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
              className="w-full rounded-lg border border-gray-border px-3 py-2"
            >
              <option value="">Все аккаунты</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.id} — {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h3 className="font-semibold text-navy">Массовое обновление ссылок</h3>
        <p className="mt-1 text-sm text-navy-muted">
          По одной ссылке на строку. Ссылки привязываются к задачам аккаунта по порядку.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
          <label className="block text-sm">
            <span className="mb-1 block text-navy-muted">Аккаунт</span>
            <select
              value={bulkAccountId}
              onChange={(event) => setBulkAccountId(event.target.value)}
              className="w-full rounded-lg border border-gray-border px-3 py-2"
            >
              <option value="">Выберите</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.id} — {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-navy-muted">Ссылки</span>
            <textarea
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              rows={5}
              placeholder={"https://vk.com/remont_tv_kazan\nhttps://vk.com/club239728539\nremont_tv_ivanovo"}
              className="w-full rounded-lg border border-gray-border px-3 py-2 font-mono text-sm"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleBulkUpdate}
          disabled={bulkBusy}
          className="mt-3 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
        >
          {bulkBusy ? "Обновление..." : "Обновить ссылки массово"}
        </button>

        {bulkResult ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {bulkResult}
          </p>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-gray-border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-card text-left text-xs uppercase tracking-wide text-navy-muted">
              <tr>
                <th className="px-3 py-2">Task ID</th>
                <th className="px-3 py-2">Город</th>
                <th className="px-3 py-2">Аккаунт</th>
                <th className="px-3 py-2">Текущий VK URL</th>
                <th className="px-3 py-2">vkGroupId</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {bindingTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-navy-muted">
                    Нет задач с назначенным аккаунтом
                  </td>
                </tr>
              ) : (
                bindingTasks.map((task) => {
                  const check = checkByTaskId[task.id];
                  const busy = busyTaskId === task.id;

                  return (
                    <tr key={task.id} className="border-t border-gray-border align-top">
                      <td className="px-3 py-2 font-mono text-xs">{task.id}</td>
                      <td className="px-3 py-2">{task.city}</td>
                      <td className="px-3 py-2">{task.assignedAccount || "—"}</td>
                      <td className="px-3 py-2 max-w-[220px]">
                        {task.vkUrl ? (
                          <a
                            href={task.vkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-blue-700 hover:underline"
                          >
                            {task.vkUrl}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{task.vkGroupId || "—"}</td>
                      <td className="px-3 py-2">{VK_TASK_STATUS_LABELS[task.status]}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleUpdateUrl(task)}
                            className="rounded-lg border border-gray-border px-2.5 py-1 text-xs font-medium hover:bg-gray-card disabled:opacity-50"
                          >
                            Обновить URL
                          </button>
                          <button
                            type="button"
                            disabled={busy || !task.vkGroupId}
                            onClick={() => handleCheckGroup(task)}
                            className="rounded-lg border border-gray-border px-2.5 py-1 text-xs font-medium hover:bg-gray-card disabled:opacity-50"
                          >
                            Проверить группу
                          </button>
                        </div>

                        {check ? (
                          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-950">
                            {check.error ? (
                              <p className="text-red-700">{check.error}</p>
                            ) : (
                              <ul className="space-y-0.5">
                                <li>vkGroupId: {check.vkGroupId}</li>
                                <li>Название: {check.groupName || "—"}</li>
                                <li>Текущий URL: {check.displayUrl || "—"}</li>
                                <li>Администратор: {boolLabel(check.isAdmin)}</li>
                                <li>Публикация постов: {boolLabel(check.canPost)}</li>
                                <li>Редактирование группы: {boolLabel(check.canEdit)}</li>
                              </ul>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
