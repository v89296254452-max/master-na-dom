"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { VkImportEntity, VkImportSource } from "@/lib/vk-automation/import-types";
import { VK_IMPORT_ENTITY_LABELS } from "@/lib/vk-automation/import-types";

type EntityPreview = {
  entity: VkImportEntity;
  total: number;
  new: number;
  duplicate: number;
  updated: number;
  errors: number;
  samples: Record<string, unknown>[];
};

type PreviewData = {
  runId: string;
  dryRun: boolean;
  entities: EntityPreview[];
  warnings: string[];
  logs: Array<{
    sourceId: string;
    entity: VkImportEntity;
    action: string;
    dedupeKey: string;
    message: string;
  }>;
};

type ImportLogRow = {
  id: number;
  runId: string;
  sourceId: string;
  entity: string;
  action: string;
  message: string;
  createdAt: string;
};

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VkImportPanel() {
  const [sources, setSources] = useState<VkImportSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [recentLogs, setRecentLogs] = useState<ImportLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPreview = useCallback(async (sourceIds?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const qs = sourceIds?.length ? `?sources=${sourceIds.join(",")}` : "";
      const res = await fetch(`/api/admin/vk-automation/import/preview${qs}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Ошибка загрузки");

      setSources(json.sources ?? []);
      setPreview(json.preview ?? null);
      setRecentLogs(json.recentLogs ?? []);

      const existing = json.sources?.filter((s: VkImportSource) => s.exists).map((s: VkImportSource) => s.id) ?? [];
      setSelectedSources(new Set(sourceIds ?? existing));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  function toggleSource(id: string): void {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePreview(): Promise<void> {
    await loadPreview(Array.from(selectedSources));
    setMessage("Предпросмотр обновлён");
  }

  async function handleRun(dryRun: boolean): Promise<void> {
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/vk-automation/import/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          sourceIds: Array.from(selectedSources),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Импорт не выполнен");

      setPreview(json.result);
      setMessage(json.message);
      await loadPreview(Array.from(selectedSources));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:py-10">
      <header className="mb-6">
        <Link href="/admin/vk-automation" className="text-sm text-orange hover:underline">
          ← VK Automation
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">Импорт VK-данных</h1>
        <p className="mt-2 text-sm text-navy-muted">
          Объединение источников: ДМ1, data/*.json, vk-plan.csv, public/vk-assets. CLI:{" "}
          <code className="rounded bg-gray-card px-1">npm run vk:import-all -- --dry-run</code>
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handlePreview()}
          disabled={loading}
          className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm hover:bg-gray-card disabled:opacity-50"
        >
          Предпросмотр
        </button>
        <button
          type="button"
          onClick={() => handleRun(true)}
          disabled={running}
          className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm hover:bg-gray-card disabled:opacity-50"
        >
          Dry-run
        </button>
        <button
          type="button"
          onClick={() => handleRun(false)}
          disabled={running}
          className="rounded-lg bg-orange px-4 py-2 text-sm text-white hover:bg-orange-dark disabled:opacity-50"
        >
          Импортировать
        </button>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Источники данных</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-card text-left text-navy-muted">
              <tr>
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2">Источник</th>
                <th className="px-3 py-2">Путь</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">Размер</th>
                <th className="px-3 py-2">Сущности</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-t border-gray-border">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedSources.has(source.id)}
                      disabled={!source.exists}
                      onChange={() => toggleSource(source.id)}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {source.label}
                    {!source.exists && (
                      <span className="ml-2 text-xs text-navy-muted">(не найден)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-navy-muted max-w-xs truncate">{source.path}</td>
                  <td className="px-3 py-2">{source.kind}</td>
                  <td className="px-3 py-2">{formatBytes(source.sizeBytes)}</td>
                  <td className="px-3 py-2 text-xs">{source.entities.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {preview && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">
            Предпросмотр {preview.dryRun ? "(dry-run)" : ""} — run {preview.runId}
          </h2>
          {preview.warnings.length > 0 && (
            <ul className="mb-3 text-sm text-amber-800">
              {preview.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto rounded-lg border border-gray-border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-card text-left text-navy-muted">
                <tr>
                  <th className="px-3 py-2">Сущность</th>
                  <th className="px-3 py-2">Всего</th>
                  <th className="px-3 py-2">Новые</th>
                  <th className="px-3 py-2">Дубли</th>
                  <th className="px-3 py-2">Ошибки</th>
                </tr>
              </thead>
              <tbody>
                {preview.entities.map((row) => (
                  <tr key={row.entity} className="border-t border-gray-border">
                    <td className="px-3 py-2">{VK_IMPORT_ENTITY_LABELS[row.entity]}</td>
                    <td className="px-3 py-2">{row.total}</td>
                    <td className="px-3 py-2 text-emerald-700">{row.new}</td>
                    <td className="px-3 py-2 text-navy-muted">{row.duplicate}</td>
                    <td className="px-3 py-2 text-red-700">{row.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Лог импорта</h2>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-border bg-gray-card p-3 font-mono text-xs">
          {recentLogs.map((log) => (
            <div key={log.id} className="mb-1 border-b border-gray-border/50 py-1">
              <span className="text-navy-muted">{log.createdAt}</span>
              <span className="mx-2">[{log.action}]</span>
              <span>{log.entity}</span>
              <span className="mx-2 text-navy-muted">{log.sourceId}</span>
              <span>{log.message}</span>
            </div>
          ))}
          {recentLogs.length === 0 && <p className="text-navy-muted">Лог пуст</p>}
        </div>
      </section>
    </main>
  );
}
