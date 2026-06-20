"use client";

import { useMemo, useState } from "react";
import type { VkTask } from "@/lib/vk-task-types";
import { findDuplicateIssues, getProblematicTaskIds } from "@/lib/vk-duplicate-check";
import {
  VK_DUPLICATE_FIELD_LABELS,
  type VkDuplicateIssue,
} from "@/lib/vk-duplicate-check-types";
import type { VkAccountGroup } from "@/lib/vk-types";

const GROUP_LABELS: Record<VkAccountGroup, string> = {
  kp: "КП",
  mnch: "МнЧ",
  bt: "БТ",
};

interface VkAntiDuplicatePanelProps {
  tasks: VkTask[];
  onOpenTask: (taskId: string) => void;
  onTasksUpdated: () => Promise<void>;
}

function formatTaskMeta(issue: VkDuplicateIssue, side: 1 | 2): string {
  const group = side === 1 ? issue.group1 : issue.group2;
  const city = side === 1 ? issue.city1 : issue.city2;
  const service = side === 1 ? issue.service1 : issue.service2;
  return `${GROUP_LABELS[group]} · ${city} / ${service}`;
}

export default function VkAntiDuplicatePanel({
  tasks,
  onOpenTask,
  onTasksUpdated,
}: VkAntiDuplicatePanelProps) {
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [bulkRegenerating, setBulkRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const result = useMemo(() => findDuplicateIssues(tasks), [tasks]);
  const problematicIds = useMemo(() => getProblematicTaskIds(result), [result]);

  async function regenerateTask(taskId: string) {
    setRegeneratingId(taskId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-tasks/regenerate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось перегенерировать контент");
      }

      await onTasksUpdated();
      setMessage(`Контент перегенерирован: ${taskId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка перегенерации");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function regenerateAllProblematic() {
    if (problematicIds.length === 0) return;

    setBulkRegenerating(true);
    setError(null);
    setMessage(null);

    try {
      let updated = 0;
      const failures: string[] = [];

      for (const taskId of problematicIds) {
        const res = await fetch("/api/vk-tasks/regenerate-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          failures.push(taskId);
        } else {
          updated += 1;
        }
      }

      await onTasksUpdated();

      if (failures.length > 0) {
        setError(`Не удалось обновить: ${failures.join(", ")}`);
      }
      setMessage(`Перегенерировано задач: ${updated} из ${problematicIds.length}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка массовой перегенерации");
    } finally {
      setBulkRegenerating(false);
    }
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy">Антидубли контента</h2>
            <p className="mt-1 text-sm text-navy-muted">
              Полные дубли и похожие тексты (&gt;80% совпадения слов после нормализации)
            </p>
          </div>
          <button
            type="button"
            onClick={regenerateAllProblematic}
            disabled={bulkRegenerating || problematicIds.length === 0}
            className="rounded-lg bg-orange px-4 py-2 text-sm font-medium text-white hover:bg-orange-dark disabled:opacity-50"
          >
            {bulkRegenerating
              ? "Перегенерация..."
              : `Перегенерировать все проблемные (${problematicIds.length})`}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-border bg-gray-card px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-muted">Проверено</div>
            <div className="mt-1 text-2xl font-bold text-navy">{result.totalChecked}</div>
          </div>
          <div className="rounded-xl border border-gray-border bg-gray-card px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-muted">Полные дубли</div>
            <div className="mt-1 text-2xl font-bold text-red-700">{result.exactCount}</div>
          </div>
          <div className="rounded-xl border border-gray-border bg-gray-card px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-muted">Похожие</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{result.similarCount}</div>
          </div>
          <div className="rounded-xl border border-gray-border bg-gray-card px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-muted">Без проблем</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{result.cleanTaskCount}</div>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-gray-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-card text-navy-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Поле</th>
              <th className="px-3 py-3 font-medium">Тип</th>
              <th className="px-3 py-3 font-medium">Задача 1</th>
              <th className="px-3 py-3 font-medium">Задача 2</th>
              <th className="px-3 py-3 font-medium">Похожесть</th>
              <th className="px-3 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {result.issues.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-navy-muted">
                  Дублей не найдено
                </td>
              </tr>
            ) : (
              result.issues.map((issue, index) => (
                <tr key={`${issue.field}-${issue.taskId1}-${issue.taskId2}-${index}`} className="border-t border-gray-border align-top">
                  <td className="px-3 py-3">{VK_DUPLICATE_FIELD_LABELS[issue.field]}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        issue.kind === "exact"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {issue.kind === "exact" ? "Полный дубль" : "Похожий"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-mono text-xs">{issue.taskId1}</div>
                    <div className="mt-1 text-xs text-navy-muted">{formatTaskMeta(issue, 1)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-mono text-xs">{issue.taskId2}</div>
                    <div className="mt-1 text-xs text-navy-muted">{formatTaskMeta(issue, 2)}</div>
                  </td>
                  <td className="px-3 py-3 font-medium">{issue.similarityPercent}%</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenTask(issue.taskId1)}
                        className="rounded-lg border border-gray-border bg-white px-2 py-1 text-xs font-medium text-navy hover:bg-gray-card"
                      >
                        Открыть задачу 1
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTask(issue.taskId2)}
                        className="rounded-lg border border-gray-border bg-white px-2 py-1 text-xs font-medium text-navy hover:bg-gray-card"
                      >
                        Открыть задачу 2
                      </button>
                      <button
                        type="button"
                        onClick={() => regenerateTask(issue.taskId1)}
                        disabled={regeneratingId === issue.taskId1 || bulkRegenerating}
                        className="rounded-lg bg-navy px-2 py-1 text-xs font-medium text-white hover:bg-navy-light disabled:opacity-50"
                      >
                        {regeneratingId === issue.taskId1 ? "..." : "Перегенерировать 1"}
                      </button>
                      <button
                        type="button"
                        onClick={() => regenerateTask(issue.taskId2)}
                        disabled={regeneratingId === issue.taskId2 || bulkRegenerating}
                        className="rounded-lg bg-navy px-2 py-1 text-xs font-medium text-white hover:bg-navy-light disabled:opacity-50"
                      >
                        {regeneratingId === issue.taskId2 ? "..." : "Перегенерировать 2"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
