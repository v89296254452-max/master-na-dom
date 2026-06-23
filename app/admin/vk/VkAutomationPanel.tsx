"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  VkAutomationJob,
  VkAutomationQueueStats,
  VkAutomationReadinessStats,
  VkWorkerMode,
} from "@/lib/vk-automation-queue-types";
import {
  VK_AUTOMATION_ACTION_LABELS,
  VK_AUTOMATION_JOB_STATUS_LABELS,
  VK_WORKER_MODES,
} from "@/lib/vk-automation-queue-types";
import { WORKER_PIPELINE, type WorkerPipelineAction } from "@/lib/vk-automation-pipeline";
import type { TaskPipelineOverviewRow } from "@/lib/vk-automation-pipeline";
import type { VkTaskStatusSnapshot } from "@/lib/vk-task-status-types";
import type { VkUrlBindBatchSummary } from "@/lib/vk-url-bind-batches-types";

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
  "—": "bg-gray-50 text-navy-muted",
};

const PIPELINE_SHORT: Record<WorkerPipelineAction, string> = {
  login_account: "login",
  upload_avatar: "avatar",
  publish_pinned_post: "pinned",
  publish_post: "post",
  save_result: "save",
};

type ViewMode = "jobs" | "pipeline";

export default function VkAutomationPanel() {
  const [stats, setStats] = useState<VkAutomationQueueStats | null>(null);
  const [readiness, setReadiness] = useState<VkAutomationReadinessStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<VkAutomationJob[]>([]);
  const [pipelineOverview, setPipelineOverview] = useState<TaskPipelineOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [taskIdsText, setTaskIdsText] = useState("");
  const [creatingFromList, setCreatingFromList] = useState(false);
  const [testTaskId, setTestTaskId] = useState("");
  const [testRunBusy, setTestRunBusy] = useState(false);
  const [taskStatusSnapshot, setTaskStatusSnapshot] = useState<VkTaskStatusSnapshot | null>(null);
  const [bindBatchIdInput, setBindBatchIdInput] = useState("");
  const [bindBatches, setBindBatches] = useState<VkUrlBindBatchSummary[]>([]);
  const [bindBatchBusy, setBindBatchBusy] = useState(false);
  const [latestBindBusy, setLatestBindBusy] = useState(false);
  const [workerMode, setWorkerMode] = useState<VkWorkerMode>("mock");
  const [uiMode, setUiMode] = useState<VkWorkerMode>("mock");
  const [viewMode, setViewMode] = useState<ViewMode>("jobs");
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
      setReadiness((data.readiness as VkAutomationReadinessStats | undefined) ?? null);
      setRecentJobs(data.recentJobs as VkAutomationJob[]);
      setPipelineOverview((data.pipelineOverview as TaskPipelineOverviewRow[] | undefined) ?? []);
      const mode = data.workerMode === "real" ? "real" : "mock";
      setWorkerMode(mode);
      setUiMode(mode);

      const statusRes = await fetch("/api/vk-task-status");
      const statusData = await statusRes.json();
      if (statusRes.ok && statusData.success && statusData.status) {
        setTaskStatusSnapshot(statusData.status as VkTaskStatusSnapshot);
      }

      const batchesRes = await fetch("/api/vk-url-bind-batches");
      const batchesData = await batchesRes.json();
      if (batchesRes.ok && batchesData.success && Array.isArray(batchesData.batches)) {
        setBindBatches(batchesData.batches as VkUrlBindBatchSummary[]);
      }
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
    if (data.readiness) setReadiness(data.readiness as VkAutomationReadinessStats);
    if (data.recentJobs) setRecentJobs(data.recentJobs as VkAutomationJob[]);
    if (data.pipelineOverview) {
      setPipelineOverview(data.pipelineOverview as TaskPipelineOverviewRow[]);
    }

    const errors = Array.isArray(data.errors)
      ? (data.errors as string[]).filter((item) => typeof item === "string" && item.trim())
      : [];

    if (errors.length > 0) {
      setError(errors.join("; "));
    } else {
      setError(null);
    }

    setMessage(typeof data.message === "string" ? data.message : fallbackMessage);
  }

  async function postQueueAction(
    action: string,
    fallback: string,
    extra: Record<string, unknown> = {}
  ) {
    const res = await fetch("/api/vk-automation-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || fallback);
    }

    await applyQueueResponse(data, data.message || fallback);

    if (!data.success && !(Array.isArray(data.errors) && data.errors.length > 0)) {
      throw new Error(data.message || fallback);
    }

    return data;
  }

  async function postQueueActionSimple(action: string, fallback: string) {
    return postQueueAction(action, fallback);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueActionSimple("generate", "Очередь сгенерирована");
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
        body: JSON.stringify({ action: "clear", statuses: ["skipped", "failed", "success"] }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Не удалось очистить очередь");
      await applyQueueResponse(data, `Удалено jobs: ${data.removed ?? 0}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка очистки");
    } finally {
      setClearing(false);
    }
  }

  async function handlePromoteAndGenerate() {
    setPromoting(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueActionSimple("promote_and_generate", "Очередь сформирована");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка формирования очереди");
    } finally {
      setPromoting(false);
    }
  }

  async function handleClearAll() {
    if (!confirm("Полностью очистить очередь? Все jobs (pending/running/failed/skipped/success) будут удалены.")) {
      return;
    }

    setClearingAll(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueActionSimple("clear_all", "Очередь полностью очищена");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка очистки очереди");
    } finally {
      setClearingAll(false);
    }
  }

  async function handleResetAndGenerate() {
    if (
      !confirm(
        "Удалить ВСЕ jobs из очереди и создать новый pipeline только для ready_for_worker с vkGroupId?"
      )
    ) {
      return;
    }

    setResetting(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueActionSimple("reset_and_generate", "Очередь пересоздана");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка пересоздания очереди");
    } finally {
      setResetting(false);
    }
  }

  async function handleRecreate() {
    if (!confirm("Пересоздать pipeline для задач ready_for_worker?")) return;
    setRecreating(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueActionSimple("recreate", "Очередь пересоздана");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка пересоздания");
    } finally {
      setRecreating(false);
    }
  }

  async function handleCreateQueueFromList() {
    if (!taskIdsText.trim()) {
      setError("Введите хотя бы один taskId");
      return;
    }

    if (!confirm("Очистить текущую очередь и создать pipeline только для указанных taskId?")) {
      return;
    }

    setCreatingFromList(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueAction("reset_and_generate_task_ids", "Очередь создана по списку", {
        taskIdsText,
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания очереди");
    } finally {
      setCreatingFromList(false);
    }
  }

  async function handleTestRunOne() {
    if (!testTaskId.trim()) {
      setError("Выберите taskId для тестового запуска");
      return;
    }

    if (!confirm(`Тестовый запуск: очистить очередь и создать pipeline только для ${testTaskId}?`)) {
      return;
    }

    setTestRunBusy(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueAction("reset_and_generate_task_ids", "Тестовая очередь создана", {
        taskIds: [testTaskId.trim()],
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка тестового запуска");
    } finally {
      setTestRunBusy(false);
    }
  }

  async function handleRunLatestBind() {
    setLatestBindBusy(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueAction("reset_and_generate_latest_bind", "Очередь создана по последней привязке");
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка запуска последней привязки");
    } finally {
      setLatestBindBusy(false);
    }
  }

  async function handleRunByBindBatchId() {
    if (!bindBatchIdInput.trim()) {
      setError("Введите batchId");
      return;
    }

    if (!confirm(`Очистить очередь и создать pipeline для batchId ${bindBatchIdInput.trim()}?`)) {
      return;
    }

    setBindBatchBusy(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueAction("reset_and_generate_bind_batch", "Очередь создана по batchId", {
        batchId: bindBatchIdInput.trim(),
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка запуска по batchId");
    } finally {
      setBindBatchBusy(false);
    }
  }

  async function handleCreateQueueForBatch(batchId: string) {
    setBindBatchBusy(true);
    setError(null);
    setMessage(null);
    try {
      await postQueueAction("reset_and_generate_bind_batch", "Очередь создана по привязке", {
        batchId,
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания очереди");
    } finally {
      setBindBatchBusy(false);
    }
  }

  const strictReadyTaskIds = taskStatusSnapshot?.strictReadyTaskIds ?? [];

  const pipelineJobs = useMemo(
    () => recentJobs.filter((job) => WORKER_PIPELINE.includes(job.action as WorkerPipelineAction)),
    [recentJobs]
  );

  const readyTaskCount = readiness?.readyForWorkerTasks ?? 0;
  const strictReadyCount = readiness?.readyForWorkerStrict ?? 0;
  const brokenReadyCount = readiness?.brokenReadyWithoutGroupId ?? 0;
  const manualSetupIncompleteCount = readiness?.manualSetupIncompleteStrict ?? 0;
  const busy =
    generating ||
    clearing ||
    clearingAll ||
    recreating ||
    promoting ||
    resetting ||
    creatingFromList ||
    testRunBusy ||
    bindBatchBusy ||
    latestBindBusy;

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
              Worker: <code className="text-xs">npm run vk:worker</code> · Posts Only pipeline (без groups.edit)
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
            <button type="button" onClick={loadQueue} disabled={loading} className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-gray-card disabled:opacity-50">
              {loading ? "..." : "Обновить"}
            </button>
            <button type="button" onClick={handleClearFinished} disabled={busy} className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-gray-card disabled:opacity-50">
              {clearing ? "..." : "Очистить skipped/failed/success"}
            </button>
            <button type="button" onClick={handleClearAll} disabled={busy} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50">
              {clearingAll ? "..." : "Полностью очистить очередь"}
            </button>
            <button type="button" onClick={handleResetAndGenerate} disabled={busy} className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50">
              {resetting ? "..." : "Очистить очередь и создать заново только из ready_for_worker"}
            </button>
            <button type="button" onClick={handlePromoteAndGenerate} disabled={busy} className="rounded-lg border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
              {promoting ? "..." : "Сформировать из готовых групп"}
            </button>
            <button type="button" onClick={handleRunLatestBind} disabled={busy || bindBatches.length === 0} className="rounded-lg border border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-50">
              {latestBindBusy ? "..." : "Запустить последнюю привязку"}
            </button>
            <button type="button" onClick={handleGenerate} disabled={busy} className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-dark disabled:opacity-50">
              {generating ? "..." : "Сгенерировать очередь"}
            </button>
          </div>
        </div>

        {uiMode === "real" && workerMode !== "real" ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Для real worker: <code>VK_WORKER_MODE=real</code> в <code>.env.local</code>
          </div>
        ) : null}

        {stats ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
            <StatCard label="Jobs" value={stats.total} />
            <StatCard label="Pending" value={stats.pending} accent="warning" />
            <StatCard label="Running" value={stats.running} />
            <StatCard label="Success" value={stats.success} accent="success" />
            <StatCard label="Failed" value={stats.failed} accent="danger" />
            <StatCard label="Skipped" value={stats.skipped} accent="muted" />
            <StatCard label="ready_for_worker" value={readyTaskCount} />
            <StatCard label="ready_for_worker_strict" value={strictReadyCount} accent="success" />
            <StatCard label="broken_ready_without_group_id" value={brokenReadyCount} accent="danger" />
            <StatCard label="manual_setup_incomplete" value={manualSetupIncompleteCount} accent="warning" />
          </div>
        ) : null}

        {manualSetupIncompleteCount > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {manualSetupIncompleteCount} задач с vkGroupId/аккаунтом, но без отметки «Группа подготовлена».
            Worker Posts Only не возьмёт их, пока не завершите вкладку «Подготовка группы».
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { value: "jobs" as const, label: "Все jobs" },
              { value: "pipeline" as const, label: "Worker pipeline" },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setViewMode(item.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                viewMode === item.value ? "bg-navy text-white" : "border border-gray-border bg-white text-navy"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-navy">Task IDs для запуска</h3>
          <p className="mt-1 text-xs text-navy-muted">
            По одному taskId на строку. Очередь будет полностью очищена перед созданием pipeline.
          </p>
          <textarea
            value={taskIdsText}
            onChange={(e) => setTaskIdsText(e.target.value)}
            rows={6}
            placeholder={"kp-kaluga\nkp-kazan\nremont-televizorov-ivanovo"}
            className="mt-2 w-full rounded-lg border border-gray-border bg-white px-3 py-2 font-mono text-xs outline-none ring-orange/30 focus:border-orange focus:ring-2"
          />
          <button
            type="button"
            onClick={handleCreateQueueFromList}
            disabled={busy || !taskIdsText.trim()}
            className="mt-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50"
          >
            {creatingFromList ? "..." : "Создать очередь по списку taskId"}
          </button>
        </div>

        <div className="border-t border-gray-border pt-4">
          <h3 className="text-sm font-semibold text-navy">Запустить по batchId</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={bindBatchIdInput}
              onChange={(e) => setBindBatchIdInput(e.target.value)}
              placeholder="bind_20260621_030500"
              className="min-w-[240px] rounded-lg border border-gray-border bg-white px-3 py-2 font-mono text-xs outline-none ring-orange/30 focus:border-orange focus:ring-2"
            />
            <button
              type="button"
              onClick={handleRunByBindBatchId}
              disabled={busy || !bindBatchIdInput.trim()}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50"
            >
              {bindBatchBusy ? "..." : "Запустить по batchId"}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-border pt-4">
          <h3 className="text-sm font-semibold text-navy">Последние привязки (10)</h3>
          {bindBatches.length === 0 ? (
            <p className="mt-2 text-xs text-navy-muted">Нет сохранённых batchId. Выполните массовую привязку.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-border">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-gray-card text-navy-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Дата</th>
                    <th className="px-3 py-2 font-medium">batchId</th>
                    <th className="px-3 py-2 font-medium">Аккаунт</th>
                    <th className="px-3 py-2 font-medium">Ссылки</th>
                    <th className="px-3 py-2 font-medium">Задач</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {bindBatches.map((batch) => (
                    <tr key={batch.batchId} className="border-t border-gray-border">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(batch.createdAt)}</td>
                      <td className="px-3 py-2 font-mono">{batch.batchId}</td>
                      <td className="px-3 py-2 font-mono">{batch.accountId}</td>
                      <td className="px-3 py-2">{batch.linksTotal}</td>
                      <td className="px-3 py-2">{batch.tasksUpdated}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleCreateQueueForBatch(batch.batchId)}
                          disabled={busy}
                          className="rounded-md border border-teal-600 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
                        >
                          Создать очередь
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-gray-border pt-4">
          <h3 className="text-sm font-semibold text-navy">Тестовый запуск 1 задачи</h3>
          <p className="mt-1 text-xs text-navy-muted">
            Только strict ready_for_worker ({strictReadyTaskIds.length} доступно)
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={testTaskId}
              onChange={(e) => setTestTaskId(e.target.value)}
              className="min-w-[220px] rounded-lg border border-gray-border bg-white px-3 py-2 text-xs"
            >
              <option value="">Выберите taskId</option>
              {strictReadyTaskIds.map((taskId) => (
                <option key={taskId} value={taskId}>
                  {taskId}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleTestRunOne}
              disabled={busy || !testTaskId}
              className="rounded-lg border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {testRunBusy ? "..." : "Запустить 1 задачу"}
            </button>
          </div>
        </div>
      </section>

      {viewMode === "pipeline" ? (
        <div className="overflow-x-auto rounded-xl border border-gray-border">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-card text-navy-muted">
              <tr>
                <th className="px-3 py-3 font-medium">taskId</th>
                <th className="px-3 py-3 font-medium">account</th>
                {WORKER_PIPELINE.map((action) => (
                  <th key={action} className="px-2 py-3 font-medium" title={VK_AUTOMATION_ACTION_LABELS[action]}>
                    {PIPELINE_SHORT[action]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pipelineOverview.length === 0 ? (
                <tr>
                  <td colSpan={2 + WORKER_PIPELINE.length} className="px-3 py-8 text-center text-navy-muted">
                    {readyTaskCount === 0
                      ? "Нет задач strict ready_for_worker"
                      : "Нет pipeline jobs. Сгенерируйте очередь."}
                  </td>
                </tr>
              ) : (
                pipelineOverview.map((row) => (
                  <tr key={row.taskId} className="border-t border-gray-border">
                    <td className="px-3 py-2 font-mono">{row.taskId}</td>
                    <td className="px-3 py-2 font-mono">{row.accountId || "—"}</td>
                    {WORKER_PIPELINE.map((action) => {
                      const status = row.steps[action];
                      return (
                        <td key={action} className="px-2 py-2">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[status] ?? "bg-gray-100"}`}
                          >
                            {status === "—" ? "—" : (VK_AUTOMATION_JOB_STATUS_LABELS[status] ?? status)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
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
              {pipelineJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-navy-muted">
                    {strictReadyCount === 0
                      ? "Нет задач strict ready_for_worker"
                      : "Очередь пуста. Сгенерируйте pipeline."}
                  </td>
                </tr>
              ) : (
                pipelineJobs.map((job) => (
                  <tr key={job.id} className="border-t border-gray-border align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium text-navy">{VK_AUTOMATION_ACTION_LABELS[job.action] ?? job.action}</div>
                      <div className="font-mono text-xs text-navy-muted">{job.action}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{job.taskId}</td>
                    <td className="px-3 py-3 font-mono text-xs">{job.accountId || "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[job.status] ?? "bg-gray-100"}`}>
                        {VK_AUTOMATION_JOB_STATUS_LABELS[job.status] ?? job.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">{job.attempts}</td>
                    <td className="px-3 py-3 max-w-[240px] text-xs text-red-700">{job.error || "—"}</td>
                    <td className="px-3 py-3 text-xs text-navy-muted whitespace-nowrap">{formatDateTime(job.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
