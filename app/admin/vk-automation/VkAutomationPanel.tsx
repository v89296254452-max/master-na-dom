"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  VkBrowserAccount,
  VkBrowserCity,
  VkBrowserGroup,
  VkBrowserJob,
  VkBrowserLogEntry,
  VkBrowserQueueStats,
} from "@/lib/vk-automation/types";
import {
  VK_BROWSER_AUTH_STATUS_LABELS,
  VK_BROWSER_ACTION_LABELS,
} from "@/lib/vk-automation/types";

type VkBrowserTask = {
  id: number;
  accountId: string;
  groupName: string;
  status: string;
};

type DashboardData = {
  accounts: VkBrowserAccount[];
  cities: VkBrowserCity[];
  groups: VkBrowserGroup[];
  tasks: VkBrowserTask[];
  jobs: VkBrowserJob[];
  logs: VkBrowserLogEntry[];
  queueStats: VkBrowserQueueStats;
  lastImportAt?: string;
  config?: { dbPath?: string; presetDir?: string; oldDataDir?: string };
};

type AccountMergeRow = {
  apiAccountId: string;
  apiName: string;
  apiPhone: string;
  apiStatus: string;
  browserAccountId: string | null;
  browserLogin: string;
  proxy: string;
  authStatus: string;
  linked: boolean;
  mergePath: string;
};

type AccountMergeData = {
  mergePath: string;
  rows: AccountMergeRow[];
};

const AUTH_BADGE: Record<string, string> = {
  connected: "bg-emerald-100 text-emerald-800",
  not_connected: "bg-gray-100 text-gray-700",
  expired: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
  manual_pending: "bg-blue-100 text-blue-800",
};

const JOB_BADGE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  running: "bg-blue-100 text-blue-800",
  success: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-amber-100 text-amber-800",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

export default function VkAutomationPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dataSource, setDataSource] = useState<"project" | "legacy">("project");
  const [dataSourceLabel, setDataSourceLabel] = useState("");
  const [buildLimit, setBuildLimit] = useState(10);
  const [accountMerge, setAccountMerge] = useState<AccountMergeData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, srcRes, mergeRes] = await Promise.all([
        fetch("/api/admin/vk-automation"),
        fetch("/api/admin/vk-automation/data-source"),
        fetch("/api/admin/vk-automation/account-merge"),
      ]);
      const json = await dashRes.json();
      const srcJson = await srcRes.json();
      const mergeJson = await mergeRes.json();

      if (!dashRes.ok || !json.success) throw new Error(json.error || "Ошибка загрузки");
      if (srcJson.success) {
        setDataSource(srcJson.source === "legacy" ? "legacy" : "project");
        setDataSourceLabel(srcJson.sourceLabel ?? "");
      }
      if (mergeJson.success) {
        setAccountMerge({
          mergePath: mergeJson.mergePath,
          rows: mergeJson.rows ?? [],
        });
      }

      setData(json);

      const defaultAccountId =
        srcJson.source === "legacy"
          ? json.accounts?.[0]?.id
          : mergeJson.rows?.find((row: AccountMergeRow) => row.linked)?.apiAccountId
            ?? mergeJson.rows?.[0]?.apiAccountId;

      if (!selectedAccountId && defaultAccountId) {
        setSelectedAccountId(defaultAccountId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setDataSourceMode(source: "project" | "legacy") {
    setActionId("source");
    try {
      const res = await fetch("/api/admin/vk-automation/data-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Ошибка");
      setDataSource(source);
      setDataSourceLabel(json.sourceLabel ?? "");
      setMessage(`Источник: ${json.sourceLabel}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionId(null);
    }
  }

  async function buildGroupTasks() {
    setActionId("build");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/vk-automation/build-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: buildLimit,
          accountId: selectedAccountId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Ошибка");
      setMessage(json.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionId(null);
    }
  }

  async function runImport() {
    setActionId("import");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/vk-automation/import", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Импорт не выполнен");
      setMessage(
        `Импорт: accounts=${json.result.accounts}, cities=${json.result.cities}, tasks=${json.result.tasks}`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setActionId(null);
    }
  }

  async function queueAction(action: string, accountId?: string) {
    setActionId(action);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/vk-automation/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, accountId: accountId ?? selectedAccountId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Ошибка");
      setMessage(json.job ? `Задача создана: ${json.job.action}. Запустите npm run vk:worker` : "OK");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionId(null);
    }
  }

  async function runBatch() {
    if (!data) return;
    setActionId("batch");
    try {
      const accountIds =
        dataSource === "project"
          ? (accountMerge?.rows.filter((row) => row.linked && row.apiStatus === "active").map((row) => row.apiAccountId) ?? [])
          : data.accounts.filter((a) => a.status === "active").map((a) => a.id);
      const res = await fetch("/api/admin/vk-automation/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch", accountIds, limit: 5 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Ошибка");
      setMessage(`Пакет: ${json.count} задач. Запустите npm run vk:worker`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionId(null);
    }
  }

  if (loading && !data) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-10">
        <p className="text-navy-muted">Загрузка...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">VK Browser Automation</h1>
        <p className="mt-2 max-w-3xl text-sm text-navy-muted sm:text-base">
          Playwright-автоматизация VK (не API). Worker:{" "}
          <code className="rounded bg-gray-card px-1.5 py-0.5">npm run vk:worker</code>
        </p>
        {data?.config && (
          <p className="mt-2 text-xs text-navy-muted">
            DB: <code className="rounded bg-gray-card px-1">{data.config.dbPath}</code>
            {data.config.oldDataDir && (
              <>
                {" · "}ДМ1: <code className="rounded bg-gray-card px-1">{data.config.oldDataDir}</code>
              </>
            )}
          </p>
        )}
      </header>

      <section className="mb-6 rounded-lg border border-gray-border bg-gray-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Источник данных</h2>
        <p className="mb-3 text-sm text-navy-muted">
          Активный: <strong>{dataSourceLabel || "SEO + VK API automation"}</strong>
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setDataSourceMode("project")}
            disabled={actionId !== null}
            className={`rounded-lg px-4 py-2 text-sm ${
              dataSource === "project"
                ? "bg-navy text-white"
                : "border border-gray-border bg-white hover:bg-gray-card"
            }`}
          >
            SEO + VK API automation
          </button>
          <button
            type="button"
            onClick={() => setDataSourceMode("legacy")}
            disabled={actionId !== null}
            className={`rounded-lg px-4 py-2 text-sm ${
              dataSource === "legacy"
                ? "bg-navy text-white"
                : "border border-gray-border bg-white hover:bg-gray-card"
            }`}
          >
            Legacy ZennoPoster DB
          </button>
          <label className="ml-4 text-sm text-navy-muted">
            Лимит
            <input
              type="number"
              min={1}
              max={100}
              value={buildLimit}
              onChange={(e) => setBuildLimit(Number(e.target.value) || 10)}
              className="ml-2 w-16 rounded border border-gray-border px-2 py-1"
            />
          </label>
          <button
            type="button"
            onClick={() => buildGroupTasks()}
            disabled={actionId !== null}
            className="rounded-lg bg-orange px-4 py-2 text-sm text-white hover:bg-orange-dark disabled:opacity-50"
          >
            Собрать задачи для групп
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Связка аккаунтов</h2>
        <p className="mb-3 text-sm text-navy-muted">
          VK API аккаунты из <code className="rounded bg-gray-card px-1">data/vk-accounts.json</code> связаны с browser
          credentials из SQLite через{" "}
          <code className="rounded bg-gray-card px-1">
            {accountMerge?.mergePath ?? "data/vk-account-merge.json"}
          </code>
          . Worker использует только login/password/proxy/session — без API token.
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-card text-left text-navy-muted">
              <tr>
                <th className="px-3 py-2">API account</th>
                <th className="px-3 py-2">Browser login</th>
                <th className="px-3 py-2">Proxy</th>
                <th className="px-3 py-2">Auth</th>
                <th className="px-3 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {accountMerge?.rows.map((row) => (
                <tr key={row.apiAccountId} className="border-t border-gray-border">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAccountId(row.apiAccountId)}
                      className={`font-medium ${selectedAccountId === row.apiAccountId ? "text-orange" : "text-navy"}`}
                    >
                      {row.apiAccountId}
                    </button>
                    <div className="text-xs text-navy-muted">{row.apiName}</div>
                    <div className="text-xs text-navy-muted">{row.apiPhone}</div>
                    {!row.linked && (
                      <div className="mt-1 text-xs text-amber-700">Не привязан browser account</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.browserLogin || "—"}</td>
                  <td className="px-3 py-2 text-navy-muted">{row.proxy || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${AUTH_BADGE[row.authStatus] ?? ""}`}>
                      {VK_BROWSER_AUTH_STATUS_LABELS[row.authStatus as keyof typeof VK_BROWSER_AUTH_STATUS_LABELS] ?? row.authStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.linked ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => queueAction("auth_open", row.apiAccountId)}
                          disabled={actionId !== null}
                          className="text-xs text-orange hover:underline disabled:opacity-50"
                        >
                          Открыть авторизацию
                        </button>
                        <button
                          type="button"
                          onClick={() => queueAction("auth_check", row.apiAccountId)}
                          disabled={actionId !== null}
                          className="text-xs text-navy hover:underline disabled:opacity-50"
                        >
                          Проверить
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-navy-muted">Заполните merge</span>
                    )}
                  </td>
                </tr>
              ))}
              {accountMerge?.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-navy-muted">
                    Нет API аккаунтов или файл merge не найден.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => runImport()}
          disabled={actionId === "import"}
          className="rounded-lg bg-navy px-4 py-2 text-sm text-white hover:bg-navy-light disabled:opacity-50"
        >
          Импорт из vk_dors.db
        </button>
        <button
          type="button"
          onClick={() => queueAction("create_test_group")}
          disabled={!selectedAccountId || actionId !== null}
          className="rounded-lg bg-orange px-4 py-2 text-sm text-white hover:bg-orange-dark disabled:opacity-50"
        >
          Запустить 1 группу
        </button>
        <button
          type="button"
          onClick={() => runBatch()}
          disabled={actionId !== null}
          className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm hover:bg-gray-card disabled:opacity-50"
        >
          Запустить пакет
        </button>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm hover:bg-gray-card"
        >
          Обновить
        </button>
        <Link
          href="/admin/vk-automation/import"
          className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm hover:bg-gray-card"
        >
          Импорт данных
        </Link>
      </div>

      {data?.queueStats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
          {(["total", "pending", "running", "success", "failed", "skipped"] as const).map((key) => (
            <div key={key} className="rounded-lg border border-gray-border bg-gray-card px-3 py-2">
              <div className="text-xs text-navy-muted">{key}</div>
              <div className="text-lg font-semibold">{data.queueStats[key]}</div>
            </div>
          ))}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Browser accounts (SQLite)</h2>
        <p className="mb-3 text-sm text-navy-muted">
          Credentials из импорта ДМ1. Не дублируются в vk-accounts.json — связка через merge файл.
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-card text-left text-navy-muted">
              <tr>
                <th className="px-3 py-2">Login</th>
                <th className="px-3 py-2">Proxy</th>
                <th className="px-3 py-2">Auth</th>
                <th className="px-3 py-2">Last use</th>
                <th className="px-3 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {data?.accounts.map((account) => (
                <tr key={account.id} className="border-t border-gray-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{account.login}</div>
                    <div className="text-xs text-navy-muted">id: {account.id}</div>
                  </td>
                  <td className="px-3 py-2 text-navy-muted">{account.proxy || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${AUTH_BADGE[account.authStatus] ?? ""}`}>
                      {VK_BROWSER_AUTH_STATUS_LABELS[account.authStatus]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-navy-muted">{formatDate(account.lastUse)}</td>
                  <td className="px-3 py-2 text-navy-muted">—</td>
                </tr>
              ))}
              {data?.accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-navy-muted">Нет аккаунтов. Выполните импорт.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Задания (очередь)</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-card text-left text-navy-muted">
                <tr>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.jobs.map((job) => (
                  <tr key={job.id} className="border-t border-gray-border">
                    <td className="px-3 py-2">{VK_BROWSER_ACTION_LABELS[job.action] ?? job.action}</td>
                    <td className="px-3 py-2">{job.accountId}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${JOB_BADGE[job.status] ?? ""}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-navy-muted">{formatDate(job.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Созданные группы</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-card text-left text-navy-muted">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">Account</th>
                </tr>
              </thead>
              <tbody>
                {data?.groups.map((group) => (
                  <tr key={group.id} className="border-t border-gray-border">
                    <td className="px-3 py-2">{group.name}</td>
                    <td className="px-3 py-2">
                      {group.vkUrl ? (
                        <a href={group.vkUrl} target="_blank" rel="noopener noreferrer" className="text-orange hover:underline">
                          {group.vkUrl}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-navy-muted">{group.accountId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Лог выполнения</h2>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-border bg-gray-card p-3 font-mono text-xs">
          {data?.logs.map((entry) => (
            <div key={entry.id} className="mb-1 border-b border-gray-border/50 py-1 last:border-0">
              <span className="text-navy-muted">{formatDate(entry.createdAt)}</span>
              <span className="mx-2 text-navy-muted">[{entry.level}]</span>
              <span>{entry.message}</span>
              {entry.screenshotPath && (
                <span className="ml-2 text-orange">{entry.screenshotPath}</span>
              )}
            </div>
          ))}
          {data?.logs.length === 0 && <p className="text-navy-muted">Лог пуст</p>}
        </div>
      </section>

      {data && data.cities.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Города ({data.cities.length})</h2>
          <p className="text-sm text-navy-muted">
            {data.cities.slice(0, 20).map((c) => c.name).join(", ")}
            {data.cities.length > 20 && "..."}
          </p>
        </section>
      )}
    </main>
  );
}
