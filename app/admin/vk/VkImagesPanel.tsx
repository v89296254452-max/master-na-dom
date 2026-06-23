"use client";

import { useEffect, useMemo, useState } from "react";
import type { VkTask } from "@/lib/vk-task-types";
import VkTaskImagesBlock from "./VkTaskImagesBlock";

interface VkImagesPanelProps {
  tasks: VkTask[];
  initialTaskId?: string;
  onTaskUpdated: (task: VkTask) => void;
  onTasksUpdated?: (tasks: VkTask[]) => void;
}

export default function VkImagesPanel({
  tasks,
  initialTaskId = "",
  onTaskUpdated,
  onTasksUpdated,
}: VkImagesPanelProps) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [search, setSearch] = useState("");
  const [assigningTask, setAssigningTask] = useState(false);
  const [assigningBatch, setAssigningBatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
    }
  }, [initialTaskId]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter(
      (task) =>
        task.id.toLowerCase().includes(query) ||
        task.city.toLowerCase().includes(query) ||
        task.vkName.toLowerCase().includes(query)
    );
  }, [search, tasks]);

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ??
    filteredTasks[0] ??
    null;

  const readyForWorkerCount = useMemo(
    () => tasks.filter((task) => task.status === "ready_for_worker").length,
    [tasks]
  );

  async function handleAssignRandomTask() {
    if (!selectedTask) return;

    setAssigningTask(true);
    setError(null);
    setMessage(null);
    setWarnings([]);

    try {
      const res = await fetch("/api/vk-images/assign-random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: selectedTask.id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось назначить картинки");
      }

      onTaskUpdated(data.task as VkTask);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setMessage(`Случайные картинки назначены задаче ${selectedTask.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка назначения картинок");
    } finally {
      setAssigningTask(false);
    }
  }

  async function handleAssignRandomBatch() {
    setAssigningBatch(true);
    setError(null);
    setMessage(null);
    setWarnings([]);

    try {
      const res = await fetch("/api/vk-images/assign-random-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [] }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось назначить картинки");
      }

      const updatedTasks = Array.isArray(data.tasks) ? (data.tasks as VkTask[]) : [];
      if (updatedTasks.length > 0) {
        onTasksUpdated?.(updatedTasks);
      }
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setMessage(`Назначено задач: ${data.processed ?? updatedTasks.length}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка batch-назначения");
    } finally {
      setAssigningBatch(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Изображения VK</h2>
        <p className="mt-1 text-sm text-navy-muted">
          Подготовка аватаров, обложек и картинок для постов из папок public/vk-assets.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAssignRandomTask}
            disabled={!selectedTask || assigningTask}
            className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
          >
            {assigningTask ? "Назначение..." : "Назначить случайные картинки задаче"}
          </button>
          <button
            type="button"
            onClick={handleAssignRandomBatch}
            disabled={assigningBatch || readyForWorkerCount === 0}
            className="rounded-xl border border-gray-border bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:bg-gray-card disabled:opacity-50"
          >
            {assigningBatch
              ? "Назначение..."
              : `Назначить случайные картинки всем ready_for_worker (${readyForWorkerCount})`}
          </button>
        </div>

        {(error || message) && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}

        {warnings.length > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Предупреждения:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-muted">Поиск задачи</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="id, город, название..."
              className="w-full rounded-lg border border-gray-border px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-muted">taskId</label>
            <select
              value={selectedTask?.id ?? ""}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full rounded-lg border border-gray-border px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
            >
              {filteredTasks.length === 0 ? (
                <option value="">Нет задач</option>
              ) : (
                filteredTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.id} — {task.city}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      {selectedTask ? (
        <VkTaskImagesBlock
          task={selectedTask}
          variant="admin"
          onTaskUpdated={onTaskUpdated}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
          Выберите задачу для работы с изображениями
        </div>
      )}
    </div>
  );
}
