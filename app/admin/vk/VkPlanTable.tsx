"use client";

import { useMemo, useState } from "react";
import type { VkAccountGroup, VkPlanRow } from "@/lib/vk-types";

interface VkPlanTableProps {
  rows: VkPlanRow[];
}

type FilterValue = "all" | VkAccountGroup;

const GROUP_LABELS: Record<VkAccountGroup, string> = {
  kp: "КП",
  mnch: "МнЧ",
  bt: "БТ",
};

const GROUP_BADGE: Record<VkAccountGroup, string> = {
  kp: "bg-blue-100 text-blue-800",
  mnch: "bg-emerald-100 text-emerald-800",
  bt: "bg-amber-100 text-amber-800",
};

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "kp", label: "КП" },
  { value: "mnch", label: "МнЧ" },
  { value: "bt", label: "БТ" },
];

function countByGroup(rows: VkPlanRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc[row.accountGroup] += 1;
      return acc;
    },
    { kp: 0, mnch: 0, bt: 0 } as Record<VkAccountGroup, number>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "done" || normalized === "created"
      ? "bg-emerald-100 text-emerald-800"
      : normalized === "error" || normalized === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-gray-100 text-navy-muted";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {status || "pending"}
    </span>
  );
}

function ActionButton({
  label,
  copied,
  onClick,
  variant = "secondary",
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  const base =
    "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap";
  const styles =
    variant === "primary"
      ? "bg-orange text-white hover:bg-orange-dark"
      : "border border-gray-border bg-white text-navy hover:bg-gray-card";

  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {copied ? "Скопировано" : label}
    </button>
  );
}

function RowActions({
  row,
  copiedKey,
  onCopy,
}: {
  row: VkPlanRow;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const prefix = row.slug;

  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        label="Название"
        copied={copiedKey === `${prefix}-name`}
        onClick={() => onCopy(row.vkName, `${prefix}-name`)}
      />
      <ActionButton
        label="Описание"
        copied={copiedKey === `${prefix}-desc`}
        onClick={() => onCopy(row.vkDescription, `${prefix}-desc`)}
      />
      <ActionButton
        label="Первый пост"
        copied={copiedKey === `${prefix}-post`}
        onClick={() => onCopy(row.vkFirstPost, `${prefix}-post`)}
      />
      <a
        href={row.siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-lg border border-gray-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-gray-card"
      >
        Открыть сайт
      </a>
    </div>
  );
}

export default function VkPlanTable({ rows }: VkPlanTableProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const stats = useMemo(() => {
    const groups = countByGroup(rows);
    return {
      total: rows.length,
      kp: groups.kp,
      mnch: groups.mnch,
      bt: groups.bt,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (filter !== "all" && row.accountGroup !== filter) return false;
      if (!q) return true;

      return (
        row.city.toLowerCase().includes(q) ||
        row.service.toLowerCase().includes(q) ||
        row.vkName.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  async function handleCopy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Всего", value: stats.total, active: filter === "all" },
          { label: "КП", value: stats.kp, active: filter === "kp" },
          { label: "МнЧ", value: stats.mnch, active: filter === "mnch" },
          { label: "БТ", value: stats.bt, active: filter === "bt" },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border px-4 py-3 ${
              item.active ? "border-orange bg-orange/5" : "border-gray-border bg-gray-card"
            }`}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-navy-muted">
              {item.label}
            </div>
            <div className="mt-1 text-2xl font-bold text-navy">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === item.value
                  ? "bg-navy text-white"
                  : "bg-gray-card text-navy hover:bg-gray-border/60"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="text-sm text-navy-muted">
          Показано: <strong className="text-navy">{filtered.length}</strong> из {rows.length}
        </div>
      </div>

      <div>
        <input
          type="search"
          placeholder="Поиск по городу, услуге или названию VK..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-border bg-white px-4 py-2.5 text-sm outline-none ring-orange/30 placeholder:text-navy-muted/60 focus:border-orange focus:ring-2"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
          Ничего не найдено. Попробуйте изменить фильтр или поисковый запрос.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-gray-border lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-card text-navy-muted">
                <tr>
                  <th className="px-3 py-3 font-medium">Группа</th>
                  <th className="px-3 py-3 font-medium">Город</th>
                  <th className="px-3 py-3 font-medium">Услуга</th>
                  <th className="px-3 py-3 font-medium">Название VK</th>
                  <th className="px-3 py-3 font-medium">Телефон</th>
                  <th className="px-3 py-3 font-medium">Сайт</th>
                  <th className="px-3 py-3 font-medium">Статус</th>
                  <th className="px-3 py-3 font-medium min-w-[280px]">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.slug} className="border-t border-gray-border align-top hover:bg-gray-card/50">
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${GROUP_BADGE[row.accountGroup]}`}
                      >
                        {GROUP_LABELS[row.accountGroup]}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{row.city}</td>
                    <td className="px-3 py-3">{row.service}</td>
                    <td className="px-3 py-3 font-medium">{row.vkName}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{row.phone}</td>
                    <td className="px-3 py-3 max-w-[180px]">
                      <a
                        href={row.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-orange hover:underline"
                      >
                        {row.siteUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-3">
                      <RowActions row={row} copiedKey={copiedKey} onCopy={handleCopy} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 lg:hidden">
            {filtered.map((row) => (
              <article
                key={row.slug}
                className="rounded-xl border border-gray-border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${GROUP_BADGE[row.accountGroup]}`}
                    >
                      {GROUP_LABELS[row.accountGroup]}
                    </span>
                    <h2 className="mt-2 text-base font-semibold text-navy">{row.vkName}</h2>
                  </div>
                  <StatusBadge status={row.status} />
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-navy-muted">Город</dt>
                    <dd className="text-navy">{row.city}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-navy-muted">Услуга</dt>
                    <dd className="text-navy">{row.service}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-navy-muted">Телефон</dt>
                    <dd>
                      <a href={`tel:${row.phone.replace(/[^\d+]/g, "")}`} className="text-orange">
                        {row.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-navy-muted">Сайт</dt>
                    <dd>
                      <a
                        href={row.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-orange hover:underline"
                      >
                        {row.siteUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-gray-border pt-4">
                  <RowActions row={row} copiedKey={copiedKey} onCopy={handleCopy} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
