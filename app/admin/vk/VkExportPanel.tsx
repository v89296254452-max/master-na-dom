"use client";

import type { VkAccountWithStats } from "@/lib/vk-account-types";
import type { VkTaskLogEntry } from "@/lib/vk-task-log-types";
import type { VkTask } from "@/lib/vk-task-types";
import {
  buildAccountsCsv,
  buildErrorTasksCsv,
  buildGroupsCsv,
  buildPostedTasksCsv,
  buildTasksCsv,
  downloadCsv,
  formatExportDate,
} from "@/lib/vk-export";

interface VkExportPanelProps {
  tasks: VkTask[];
  accounts: VkAccountWithStats[];
  log: VkTaskLogEntry[];
  logLoading?: boolean;
  onReloadLog?: () => void;
}

function ExportButton({
  label,
  description,
  count,
  onClick,
  disabled,
}: {
  label: string;
  description: string;
  count?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start rounded-xl border border-gray-border bg-white p-4 text-left transition-colors hover:bg-gray-card disabled:cursor-not-allowed disabled:opacity-50 sm:p-5"
    >
      <span className="text-sm font-semibold text-navy">{label}</span>
      <span className="mt-1 text-xs text-navy-muted">{description}</span>
      {count !== undefined ? (
        <span className="mt-3 inline-flex rounded-full bg-gray-card px-2.5 py-0.5 text-xs font-medium text-navy">
          {count} записей
        </span>
      ) : null}
    </button>
  );
}

export default function VkExportPanel({
  tasks,
  accounts,
  log,
  logLoading = false,
  onReloadLog,
}: VkExportPanelProps) {
  const date = formatExportDate();
  const postedCount = tasks.filter((task) => task.status === "posted").length;
  const errorCount = tasks.filter((task) => task.status === "error").length;

  const disabled = tasks.length === 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Экспорт отчётов</h2>
        <p className="mt-2 text-sm text-navy-muted">
          CSV формируется в браузере из загруженных данных. Кодировка UTF-8 с BOM — корректно
          открывается в Excel на Windows. Разделитель: точка с запятой.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-navy-muted">
          <span>
            Задач: <strong className="text-navy">{tasks.length}</strong>
          </span>
          <span>
            Аккаунтов: <strong className="text-navy">{accounts.length}</strong>
          </span>
          <span>
            Журнал:{" "}
            <strong className="text-navy">
              {logLoading ? "загрузка..." : log.length}
            </strong>
          </span>
          {onReloadLog ? (
            <button
              type="button"
              onClick={onReloadLog}
              disabled={logLoading}
              className="text-orange hover:underline disabled:opacity-50"
            >
              Обновить журнал
            </button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ExportButton
          label="Скачать все задачи CSV"
          description="Полный список задач со всеми полями"
          count={tasks.length}
          disabled={disabled}
          onClick={() => downloadCsv(`vk-tasks-all-${date}.csv`, buildTasksCsv(tasks))}
        />
        <ExportButton
          label="Скачать только posted CSV"
          description="Задачи со статусом posted"
          count={postedCount}
          disabled={disabled}
          onClick={() => downloadCsv(`vk-tasks-posted-${date}.csv`, buildPostedTasksCsv(tasks))}
        />
        <ExportButton
          label="Скачать ошибки CSV"
          description="Задачи со статусом error"
          count={errorCount}
          disabled={disabled}
          onClick={() => downloadCsv(`vk-tasks-errors-${date}.csv`, buildErrorTasksCsv(tasks))}
        />
        <ExportButton
          label="Скачать отчёт по аккаунтам CSV"
          description="Лимиты и статистика по каждому аккаунту"
          count={accounts.length}
          disabled={disabled && accounts.length === 0}
          onClick={() => downloadCsv(`vk-accounts-report-${date}.csv`, buildAccountsCsv(tasks, accounts))}
        />
        <ExportButton
          label="Скачать отчёт по группам CSV"
          description="КП, МнЧ, БТ — прогресс по статусам"
          count={3}
          disabled={disabled}
          onClick={() => downloadCsv(`vk-groups-report-${date}.csv`, buildGroupsCsv(tasks))}
        />
      </div>
    </div>
  );
}
