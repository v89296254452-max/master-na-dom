"use client";

import { useCallback, useEffect, useState } from "react";
import type { VkDashboardData } from "@/lib/vk-dashboard-types";
import { VK_TASK_STATUS_LABELS } from "@/lib/vk-task-types";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function VkDashboardPanel() {
  const [dashboard, setDashboard] = useState<VkDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vk-dashboard");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить дашборд");
      }

      setDashboard(data.dashboard as VkDashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
        Загрузка дашборда...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center text-red-700">
        {error || "Данные дашборда недоступны"}
      </div>
    );
  }

  const { overall, groups, accounts, auth, today, forecast, quality, duplicates } = dashboard;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy">Общий прогресс</h2>
            <p className="mt-1 text-sm text-navy-muted">
              Выполнение: {formatPercent(overall.completionPercent)} ({overall.posted} / {overall.total})
            </p>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-gray-card"
          >
            Обновить
          </button>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-gray-card">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(overall.completionPercent, 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <StatCard label="Всего" value={overall.total} />
          <StatCard label={VK_TASK_STATUS_LABELS.new} value={overall.new} accent="muted" />
          <StatCard label={VK_TASK_STATUS_LABELS.in_progress} value={overall.in_progress} />
          <StatCard label={VK_TASK_STATUS_LABELS.created} value={overall.created} />
          <StatCard label={VK_TASK_STATUS_LABELS.filled} value={overall.filled} />
          <StatCard label={VK_TASK_STATUS_LABELS.posted} value={overall.posted} accent="success" />
          <StatCard label={VK_TASK_STATUS_LABELS.error} value={overall.error} accent="danger" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Авторизация аккаунтов</h2>
        <p className="mt-1 text-sm text-navy-muted">Статус подключения VK для автоматизации</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Всего" value={auth.total} />
          <StatCard label="Подключены" value={auth.connected} accent="success" />
          <StatCard label="Не подключены" value={auth.not_connected} accent="muted" />
          <StatCard label="Истёк" value={auth.expired} accent="warning" />
          <StatCard label="Ошибка" value={auth.error} accent="danger" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Чеклист качества</h2>
        <p className="mt-1 text-sm text-navy-muted">Заполнение обязательных и дополнительных пунктов по VK-группам</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Полный чеклист" value={quality.fullChecklist} accent="success" />
          <StatCard label="Неполный чеклист" value={quality.partialChecklist} accent="warning" />
          <StatCard label="Средний % заполнения" value={formatPercent(quality.avgFillPercent)} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Антидубли контента</h2>
        <p className="mt-1 text-sm text-navy-muted">Проверка дублей и похожих текстов между задачами</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Дубли контента" value={duplicates.exactDuplicates} accent="danger" />
          <StatCard label="Похожие тексты" value={duplicates.similarTexts} accent="warning" />
          <StatCard label="Задач без проблем" value={duplicates.cleanTasks} accent="success" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">По группам</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-navy-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Группа</th>
                <th className="px-3 py-2 font-medium">Всего</th>
                <th className="px-3 py-2 font-medium">Опубликовано</th>
                <th className="px-3 py-2 font-medium">Ошибка</th>
                <th className="px-3 py-2 font-medium">Выполнение</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.group} className="border-t border-gray-border">
                  <td className="px-3 py-3 font-semibold text-navy">{group.label}</td>
                  <td className="px-3 py-3">{group.total}</td>
                  <td className="px-3 py-3 text-emerald-700">{group.posted}</td>
                  <td className="px-3 py-3 text-red-700">{group.error}</td>
                  <td className="px-3 py-3">{formatPercent(group.completionPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-navy">Сегодня</h2>
          <p className="mt-1 text-sm text-navy-muted">Задачи, получившие статус за текущий день</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCard label={VK_TASK_STATUS_LABELS.created} value={today.created} />
            <StatCard label={VK_TASK_STATUS_LABELS.filled} value={today.filled} />
            <StatCard label={VK_TASK_STATUS_LABELS.posted} value={today.posted} accent="success" />
          </div>
        </section>

        <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-navy">Прогноз завершения</h2>
          {forecast.hasActivity ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-gray-border pb-2">
                <span className="text-navy-muted">Средний темп (7 дней)</span>
                <span className="font-semibold text-navy">{forecast.avgPostedPerDay} / день</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-border pb-2">
                <span className="text-navy-muted">Осталось</span>
                <span className="font-semibold text-navy">{forecast.remaining}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-navy-muted">Прогноз до завершения</span>
                <span className="font-semibold text-navy">
                  {forecast.forecastDays === null
                    ? "—"
                    : forecast.forecastDays === 0
                      ? "Завершено"
                      : `~${forecast.forecastDays} дн.`}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-navy-muted">
              За последние 7 дней нет активности по публикации — прогноз недоступен.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">По аккаунтам</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-navy-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Аккаунт</th>
                <th className="px-3 py-2 font-medium">Назначено</th>
                <th className="px-3 py-2 font-medium">Создано</th>
                <th className="px-3 py-2 font-medium">Заполнено</th>
                <th className="px-3 py-2 font-medium">Опубликовано</th>
                <th className="px-3 py-2 font-medium">Ошибка</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-navy-muted">
                    Нет данных по аккаунтам
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.accountId} className="border-t border-gray-border">
                    <td className="px-3 py-3">
                      <div className="font-medium text-navy">{account.accountName}</div>
                      <div className="font-mono text-xs text-navy-muted">{account.accountId}</div>
                    </td>
                    <td className="px-3 py-3">{account.assigned}</td>
                    <td className="px-3 py-3">{account.created}</td>
                    <td className="px-3 py-3">{account.filled}</td>
                    <td className="px-3 py-3 text-emerald-700">{account.posted}</td>
                    <td className="px-3 py-3 text-red-700">{account.error}</td>
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
