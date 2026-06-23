"use client";

import { useState } from "react";
import { VK_WORK_DATA_KEEP_ACCOUNT_IDS } from "@/lib/vk-work-data-reset-constants";

interface VkWorkDataResetReport {
  accountsKept: number;
  accountsRemoved: number;
  tasksReset: number;
  queueCleared: boolean;
  logCleared: boolean;
  bindBatchesCleared: boolean;
  warning: string | null;
}

interface VkServicePanelProps {
  onResetComplete?: () => void | Promise<void>;
}

export default function VkServicePanel({ onResetComplete }: VkServicePanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<VkWorkDataResetReport | null>(null);

  async function handleReset() {
    const confirmed = window.confirm(
      [
        "Сбросить все рабочие данные VK Task Manager?",
        "",
        "Будет выполнено:",
        `• оставить аккаунты ${VK_WORK_DATA_KEEP_ACCOUNT_IDS.join(", ")}`,
        "• сбросить все задачи в status=new",
        "• очистить vkUrl, vkGroupId, назначения, image paths",
        "• очистить очередь автоматизации и журнал",
        "• очистить batch-привязки",
        "",
        "НЕ будут затронуты: vk-plan, шаблоны, public/vk-assets, токены аккаунтов 01–05.",
      ].join("\n")
    );

    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch("/api/vk-reset-work-data", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось выполнить сброс");
      }

      setReport({
        accountsKept: data.accountsKept ?? 0,
        accountsRemoved: data.accountsRemoved ?? 0,
        tasksReset: data.tasksReset ?? 0,
        queueCleared: data.queueCleared === true,
        logCleared: data.logCleared === true,
        bindBatchesCleared: data.bindBatchesCleared === true,
        warning: typeof data.warning === "string" ? data.warning : null,
      });

      await onResetComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сброса");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Сервис</h2>
        <p className="mt-1 text-sm text-navy-muted">
          Подготовка VK Task Manager к новому запуску: сброс привязок, очереди и рабочих полей задач.
        </p>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Сохраняются:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Аккаунты {VK_WORK_DATA_KEEP_ACCOUNT_IDS.join(", ")} с токенами и лимитами</li>
            <li>Контент задач: vkName, vkDescription, contentPack, prompts, city, service, slug</li>
            <li>Шаблоны и файлы в public/vk-assets</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "Сброс..." : "Сбросить рабочие данные"}
        </button>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {report ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <h3 className="font-semibold text-emerald-950">Отчёт о сбросе</h3>
          <ul className="mt-3 space-y-1">
            <li>Аккаунтов сохранено: {report.accountsKept}</li>
            <li>Аккаунтов удалено: {report.accountsRemoved}</li>
            <li>Задач сброшено: {report.tasksReset}</li>
            <li>Очередь очищена: {report.queueCleared ? "да" : "нет"}</li>
            <li>Журнал очищен: {report.logCleared ? "да" : "нет"}</li>
            <li>Batch-привязки очищены: {report.bindBatchesCleared ? "да" : "нет"}</li>
          </ul>
          {report.warning ? (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-amber-900">
              {report.warning}
            </p>
          ) : null}
          <p className="mt-3 text-emerald-800">
            Система готова к новой привязке групп.
          </p>
        </section>
      ) : null}
    </div>
  );
}
