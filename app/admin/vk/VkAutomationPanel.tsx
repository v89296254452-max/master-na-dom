"use client";

import { useCallback, useEffect, useState } from "react";
import type { VkAutomationJob, VkAutomationQueueStats, VkWorkerMode } from "@/lib/vk-automation-queue-types";
import {
  VK_AUTOMATION_ACTION_LABELS,
  VK_AUTOMATION_JOB_STATUS_LABELS,
  VK_WORKER_MODES,
} from "@/lib/vk-automation-queue-types";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warning" | "danger" | "muted";
}) {
  const accentClass =
    accent === "success"
      ? "text-emerald-700"
      : accent === "warning"
        ? "text-amber-700"
        : accent === "danger"
          ? "text-red-700"
          : accent === "muted"
            ? "text-navy-muted"
            : "text-navy";

  return (
    <div className="rounded-xl border border-gray-border bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-navy-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accentClass}`}>{value}</div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  running: "bg-blue-100 text-blue-800",
  success: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-700",
};

export default function VkAutomationPanel() {
  const [stats, setStats] = useState<VkAutomationQueueStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<VkAutomationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [workerMode, setWorkerMode] = useState<VkWorkerMode>("mock");
  const [uiMode, setUiMode] = useState<VkWorkerMode>("mock");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vk-automation-queue");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить очередь");
      }

      setStats(data.stats as VkAutomationQueueStats);
      setRecentJobs(data.recentJobs as VkAutomationJob[]);
      const mode = data.workerMode === "real" ? "real" : "mock";
      setWorkerMode(mode);
      setUiMode(mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  async function applyQueueResponse(data: Record<string, unknown>, fallbackMessage: string) {
    if (data.stats) setStats(data.stats as VkAutomationQueueStats);
    if (data.recentJobs) setRecentJobs(data.recentJobs as VkAutomationJob[]);

    const errors = Array.isArray(data.errors)
      ? (data.errors as string[]).filter((item) => typeof item === "string" && item.trim())
      : [];

    if (errors.length > 0) {
      setError(errors.join("; "));
      if (typeof data.message === "string" && data.message.trim()) {
        setMessage(data.message);
      }
      return;
    }

    setError(null);
    setMessage(typeof data.message === "string" ? data.message : fallbackMessage);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-automation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Не удалось сгенерировать очередь");
      }

      await applyQueueResponse(data, `Создано jobs: ${data.created ?? 0}`);

      if (!data.success && !(Array.isArray(data.errors) && data.errors.length > 0)) {
        throw new Error(data.message || "Не удалось сгенерировать очередь");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  }

  async function handleClearFinished() {
    setClearing(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-automation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear",
          statuses: ["skipped", "failed", "success"],
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось очистить очередь");
      }

      await applyQueueResponse(data, `Удалено jobs: ${data.removed ?? 0}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка очистки");
    } finally {
      setClearing(false);
    }
  }

  async function handleRecreate() {
    if (!confirm("Пересоздать очередь для всех in_progress задач? Pending/running/skipped/failed/success будут удалены.")) {
      return;
    }

    setRecreating(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-automation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recreate" }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Не удалось пересоздать очередь");
      }

      await applyQueueResponse(
        data,
        `Удалено: ${data.removed ?? 0}, создано: ${data.created ?? 0}`
      );

      if (!data.success && !(Array.isArray(data.errors) && data.errors.length > 0)) {
        throw new Error(data.message || "Не удалось пересоздать очередь");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка пересоздания");
    } finally {
      setRecreating(false);
    }
  }

  if (loading && !stats) {
    return (
      <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
        Загрузка очереди автоматизации...
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy">VK Automation Queue</h2>
            <p className="mt-1 text-sm text-navy-muted">
              Worker запускается отдельно: <code className="text-xs">npm run vk:worker</code>
            </p>
            <p className="mt-1 text-xs text-navy-muted">
              Активный режим worker: <strong>{workerMode}</strong> (из env <code>VK_WORKER_MODE</code>)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-border bg-gray-card p-1">
              {VK_WORKER_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setUiMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    uiMode === mode ? "bg-navy text-white" : "text-navy hover:bg-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={loadQueue}
              disabled={loading}
              className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-gray-card disabled:opacity-50"
            >
              {loading ? "Обновление..." : "Обновить"}
            </button>
            <button
              type="button"
              onClick={handleClearFinished}
              disabled={clearing || generating || recreating}
              className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-gray-card disabled:opacity-50"
            >
              {clearing ? "Очистка..." : "Очистить skipped/failed/success"}
            </button>
            <button
              type="button"
              onClick={handleRecreate}
              disabled={recreating || generating || clearing}
              className="rounded-lg border border-orange bg-orange/10 px-4 py-2 text-sm font-semibold text-orange hover:bg-orange/20 disabled:opacity-50"
            >
              {recreating ? "Пересоздание..." : "Пересоздать очередь"}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || clearing || recreating}
              className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-dark disabled:opacity-50"
            >
              {generating ? "Генерация..." : "Сгенерировать очередь"}
            </button>
          </div>
        </div>

        {uiMode === "real" && workerMode !== "real" ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Для real worker задайте <code>VK_WORKER_MODE=real</code> в <code>.env.local</code> и перезапустите{" "}
            <code>npm run vk:worker</code>.
          </div>
        ) : null}

        {uiMode === "real" && workerMode === "real" ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Real mode активен. Worker использует официальный VK API и accessToken аккаунта.
          </div>
        ) : null}

        {stats ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Всего" value={stats.total} />
            <StatCard label="Pending" value={stats.pending} accent="warning" />
            <StatCard label="Running" value={stats.running} />
            <StatCard label="Success" value={stats.success} accent="success" />
            <StatCard label="Failed" value={stats.failed} accent="danger" />
            <StatCard label="Skipped" value={stats.skipped} accent="muted" />
          </div>
        ) : null}
      </section>

      <div className="overflow-x-auto rounded-xl border border-gray-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-card text-navy-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Action</th>
              <th className="px-3 py-3 font-medium">Task ID</th>
              <th className="px-3 py-3 font-medium">Account ID</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Attempts</th>
              <th className="px-3 py-3 font-medium">Error</th>
              <th className="px-3 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {recentJobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-navy-muted">
                  Очередь пуста. Нажмите «Сгенерировать очередь» для задач in_progress.
                </td>
              </tr>
            ) : (
              recentJobs.map((job) => (
                <tr key={job.id} className="border-t border-gray-border align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium text-navy">
                      {VK_AUTOMATION_ACTION_LABELS[job.action] ?? job.action}
                    </div>
                    <div className="font-mono text-xs text-navy-muted">{job.action}</div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{job.taskId}</td>
                  <td className="px-3 py-3 font-mono text-xs">{job.accountId || "—"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[job.status] ?? "bg-gray-100"}`}
                    >
                      {VK_AUTOMATION_JOB_STATUS_LABELS[job.status] ?? job.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">{job.attempts}</td>
                  <td className="px-3 py-3 max-w-[240px] text-xs text-red-700">{job.error || "—"}</td>
                  <td className="px-3 py-3 text-xs text-navy-muted whitespace-nowrap">
                    {formatDateTime(job.updatedAt)}
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
