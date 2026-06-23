"use client";

import { useCallback, useMemo, useState } from "react";
import type { VkAccountWithStats } from "@/lib/vk-account-types";
import { isTaskReadyForWorker } from "@/lib/vk-automation-readiness";
import { buildGroupPrepCsv } from "@/lib/vk-group-prep-export";
import { normalizeImageAssets } from "@/lib/vk-image-assets-types";
import {
  formatManualSetupScore,
  isManualSetupPrepared,
  VK_GROUP_PREP_CHECKLIST_KEYS,
  VK_MANUAL_SETUP_LABELS,
  type VkGroupPrepFilter,
  type VkTaskManualSetup,
} from "@/lib/vk-manual-setup";
import { buildVkShortUrl } from "@/lib/vk-screen-name";
import type { VkTask } from "@/lib/vk-task-types";
import { VK_TASK_STATUS_LABELS } from "@/lib/vk-task-types";

const PREP_FILTERS: Array<{ value: VkGroupPrepFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "unprepared", label: "Не подготовлены" },
  { value: "prepared", label: "Подготовлены" },
  { value: "ready_for_publication", label: "Готовы к публикации" },
];

const VK_ASSET_FOLDERS = [
  { label: "Аватары", path: "/vk-assets/avatars/" },
  { label: "Обложки", path: "/vk-assets/covers/" },
  { label: "Посты", path: "/vk-assets/posts/" },
];

function CopyButton({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value, copyKey)}
      disabled={!value.trim()}
      className="rounded-lg border border-gray-border bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-card disabled:opacity-50"
    >
      {copiedKey === copyKey ? "Скопировано" : label}
    </button>
  );
}

function matchesPrepFilter(
  task: VkTask,
  filter: VkGroupPrepFilter,
  accounts: VkAccountWithStats[]
): boolean {
  if (filter === "all") return true;

  const prepared = isManualSetupPrepared(task.manualSetup);

  if (filter === "unprepared") {
    return !prepared;
  }

  if (filter === "prepared") {
    return prepared && task.status !== "ready_for_worker";
  }

  if (filter === "ready_for_publication") {
    return isTaskReadyForWorker(task, accounts);
  }

  return true;
}

interface VkGroupPrepPanelProps {
  tasks: VkTask[];
  accounts: VkAccountWithStats[];
  onTaskUpdated: (task: VkTask) => void;
  onOpenImagesTab?: (taskId: string) => void;
}

export default function VkGroupPrepPanel({
  tasks,
  accounts,
  onTaskUpdated,
  onOpenImagesTab,
}: VkGroupPrepPanelProps) {
  const [filter, setFilter] = useState<VkGroupPrepFilter>("unprepared");
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!matchesPrepFilter(task, filter, accounts)) return false;
      if (!query) return true;
      return (
        task.id.toLowerCase().includes(query) ||
        task.city.toLowerCase().includes(query) ||
        task.vkName.toLowerCase().includes(query) ||
        task.slug.toLowerCase().includes(query)
      );
    });
  }, [accounts, filter, search, tasks]);

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? null;

  const handleCopy = useCallback(async (text: string, key: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
    } catch {
      setError("Не удалось скопировать в буфер обмена");
    }
  }, []);

  async function saveManualSetup(task: VkTask, patch: Partial<VkTaskManualSetup>) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          manualSetup: {
            ...task.manualSetup,
            ...patch,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось сохранить");
      }
      onTaskUpdated(data.task as VkTask);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPrepared(task: VkTask) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          action: "markGroupPrepared",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось отметить группу как подготовленную");
      }
      onTaskUpdated(data.task as VkTask);
      setMessage(`Группа подготовлена: ${task.id} → ready_for_worker`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  function handleExportCsv() {
    const csv = buildGroupPrepCsv(filteredTasks);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vk-group-prep-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Экспортировано задач: ${filteredTasks.length}`);
  }

  const imageAssets = selectedTask ? normalizeImageAssets(selectedTask.imageAssets) : null;
  const recommendedUrl = selectedTask ? buildVkShortUrl(selectedTask.slug) : "";

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Подготовка группы</h2>
        <p className="mt-1 text-sm text-navy-muted">
          Ручная настройка VK-сообщества: название, описание, сайт, адрес, изображения. Worker берёт
          только задачи с отметкой «Группа подготовлена».
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PREP_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                filter === item.value ? "bg-navy text-white" : "border border-gray-border bg-white text-navy"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-muted">Поиск</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="taskId, город, название..."
              className="w-full rounded-lg border border-gray-border px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-muted">Задача</label>
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
                    {task.id} — {task.city} ({VK_TASK_STATUS_LABELS[task.status]})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      {(error || message) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      {selectedTask ? (
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">Основное</h3>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-navy-muted">taskId</dt><dd className="font-mono text-navy">{selectedTask.id}</dd></div>
              <div><dt className="text-navy-muted">Город</dt><dd className="text-navy">{selectedTask.city}</dd></div>
              <div><dt className="text-navy-muted">Услуга</dt><dd className="text-navy">{selectedTask.service}</dd></div>
              <div><dt className="text-navy-muted">Аккаунт</dt><dd className="text-navy">{selectedTask.assignedAccount || "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-navy-muted">vkUrl</dt><dd className="break-all text-navy">{selectedTask.vkUrl || "—"}</dd></div>
              <div><dt className="text-navy-muted">vkGroupId</dt><dd className="font-mono text-navy">{selectedTask.vkGroupId || "—"}</dd></div>
              <div><dt className="text-navy-muted">Статус</dt><dd className="text-navy">{VK_TASK_STATUS_LABELS[selectedTask.status]}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy">Название группы</h3>
              <CopyButton label="Копировать название" value={selectedTask.vkName} copyKey={`${selectedTask.id}-name`} copiedKey={copiedKey} onCopy={handleCopy} />
            </div>
            <input type="text" readOnly value={selectedTask.vkName} className="w-full rounded-lg border border-gray-border bg-gray-card px-3 py-2 text-sm text-navy" />
          </section>

          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy">Описание группы</h3>
              <CopyButton label="Копировать описание" value={selectedTask.vkDescription} copyKey={`${selectedTask.id}-desc`} copiedKey={copiedKey} onCopy={handleCopy} />
            </div>
            <textarea readOnly rows={10} value={selectedTask.vkDescription} className="w-full rounded-lg border border-gray-border bg-gray-card px-3 py-2 text-sm text-navy" />
          </section>

          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy">Сайт</h3>
              <CopyButton label="Копировать сайт" value={selectedTask.siteUrl} copyKey={`${selectedTask.id}-site`} copiedKey={copiedKey} onCopy={handleCopy} />
            </div>
            <input type="url" readOnly value={selectedTask.siteUrl} className="w-full rounded-lg border border-gray-border bg-gray-card px-3 py-2 text-sm text-navy" />
          </section>

          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy">Короткий адрес группы</h3>
              <CopyButton label="Копировать адрес" value={recommendedUrl} copyKey={`${selectedTask.id}-addr`} copiedKey={copiedKey} onCopy={handleCopy} />
            </div>
            <input type="text" readOnly value={selectedTask.slug} className="w-full rounded-lg border border-gray-border bg-gray-card px-3 py-2 font-mono text-sm text-navy" />
            <p className="mt-2 text-sm text-navy-muted">
              Рекомендуемый адрес:{" "}
              <a href={recommendedUrl} target="_blank" rel="noopener noreferrer" className="text-orange hover:underline">
                {recommendedUrl}
              </a>
            </p>
          </section>

          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-navy">Контакты</h3>
            <div className="space-y-3">
              {[
                { label: "Телефон", value: selectedTask.phone, key: "phone" },
                { label: "Лендинг", value: selectedTask.siteUrl, key: "landing" },
                { label: "Город", value: selectedTask.city, key: "city" },
              ].map((item) => (
                <div key={item.key} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-navy">
                    <span className="text-navy-muted">{item.label}: </span>
                    {item.value}
                  </div>
                  <CopyButton
                    label={`Копировать ${item.label.toLowerCase()}`}
                    value={item.value}
                    copyKey={`${selectedTask.id}-${item.key}`}
                    copiedKey={copiedKey}
                    onCopy={handleCopy}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy">Изображения</h3>
              <div className="flex flex-wrap gap-2">
                {VK_ASSET_FOLDERS.map((folder) => (
                  <a
                    key={folder.path}
                    href={folder.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-border bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-card"
                  >
                    {folder.label}
                  </a>
                ))}
                {onOpenImagesTab ? (
                  <button
                    type="button"
                    onClick={() => onOpenImagesTab(selectedTask.id)}
                    className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90"
                  >
                    Открыть папку изображений
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {imageAssets?.avatarPath ? (
                <div>
                  <div className="mb-1 text-xs text-navy-muted">avatarPath</div>
                  <img src={imageAssets.avatarPath} alt="Аватар" className="max-h-40 rounded-lg border border-gray-border object-contain" />
                </div>
              ) : null}
              {imageAssets?.coverPath ? (
                <div>
                  <div className="mb-1 text-xs text-navy-muted">coverPath</div>
                  <img src={imageAssets.coverPath} alt="Обложка" className="max-h-40 rounded-lg border border-gray-border object-contain" />
                </div>
              ) : null}
              {imageAssets?.postImagePaths.map((src, index) => (
                <div key={`${selectedTask.id}-post-${index}`}>
                  <div className="mb-1 text-xs text-navy-muted">post #{index + 1}</div>
                  <img src={src} alt={`Пост ${index + 1}`} className="max-h-40 rounded-lg border border-gray-border object-contain" />
                </div>
              ))}
            </div>
            {!imageAssets?.avatarPath && !imageAssets?.coverPath && imageAssets?.postImagePaths.length === 0 ? (
              <p className="text-sm text-navy-muted">Изображения ещё не назначены</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy">Чек-лист</h3>
              <span className="text-sm font-medium text-navy">{formatManualSetupScore(selectedTask.manualSetup)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {VK_GROUP_PREP_CHECKLIST_KEYS.map((key) => (
                <label
                  key={key}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    selectedTask.manualSetup[key]
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-gray-border bg-gray-card"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTask.manualSetup[key]}
                    disabled={saving || isManualSetupPrepared(selectedTask.manualSetup)}
                    onChange={(e) => void saveManualSetup(selectedTask, { [key]: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span className="text-navy">{VK_MANUAL_SETUP_LABELS[key]}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void handleMarkPrepared(selectedTask)}
              disabled={saving || isManualSetupPrepared(selectedTask.manualSetup)}
              className="mt-4 rounded-xl bg-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-dark disabled:opacity-50"
            >
              {saving ? "Сохранение..." : "Группа подготовлена"}
            </button>
            {isManualSetupPrepared(selectedTask.manualSetup) ? (
              <p className="mt-2 text-sm text-emerald-700">Группа отмечена как подготовленная · worker может взять задачу</p>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
          Нет задач для выбранного фильтра
        </div>
      )}

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-navy">Массовый режим</h3>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredTasks.length === 0}
            className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-gray-card disabled:opacity-50"
          >
            Экспорт подготовки группы
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-card text-navy-muted">
              <tr>
                <th className="px-3 py-2 font-medium">taskId</th>
                <th className="px-3 py-2 font-medium">vkUrl</th>
                <th className="px-3 py-2 font-medium">vkName</th>
                <th className="px-3 py-2 font-medium">slug</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-navy-muted">
                    Нет задач
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`border-t border-gray-border cursor-pointer hover:bg-gray-card/60 ${
                      selectedTask?.id === task.id ? "bg-orange/5" : ""
                    }`}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{task.id}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate">{task.vkUrl || "—"}</td>
                    <td className="px-3 py-2">{task.vkName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{task.slug}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
