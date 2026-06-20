"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VkAccountWithStats } from "@/lib/vk-account-types";
import { isAccountEligibleForAssignment } from "@/lib/vk-account-auth";
import type { VkAccountGroup } from "@/lib/vk-types";
import type { VkTask, VkTaskStatus } from "@/lib/vk-task-types";
import { VK_TASK_STATUS_LABELS, VK_TASK_STATUSES } from "@/lib/vk-task-types";
import type { VkTaskLogEntry } from "@/lib/vk-task-log-types";
import { VK_TASK_LOG_ACTION_LABELS } from "@/lib/vk-task-log-types";
import {
  canSetPostedStatus,
  formatQualityCheckScore,
  getPostedBlockedMessage,
  isQualityCheckComplete,
  VK_QUALITY_CHECK_KEYS,
  VK_QUALITY_CHECK_LABELS,
  VK_QUALITY_REQUIRED_FOR_POSTED,
  type VkTaskQualityCheck,
} from "@/lib/vk-quality-check";
import { VK_CONTENT_PACK_KEYS, VK_CONTENT_PACK_LABELS } from "@/lib/vk-content-pack";
import VkAccountsPanel from "./VkAccountsPanel";
import VkTaskLogPanel from "./VkTaskLogPanel";
import VkDashboardPanel from "./VkDashboardPanel";
import VkExportPanel from "./VkExportPanel";
import VkTemplatesPanel from "./VkTemplatesPanel";
import VkVisualTemplatesPanel from "./VkVisualTemplatesPanel";
import VkAntiDuplicatePanel from "./VkAntiDuplicatePanel";
import VkBatchAssignPanel from "./VkBatchAssignPanel";

type ViewMode = "table" | "operator" | "accounts" | "log" | "dashboard" | "export" | "templates" | "visuals" | "antiduplicates" | "assignment";
type GroupFilter = "all" | VkAccountGroup;
type StatusFilter = "all" | VkTaskStatus;

type TaskDraft = {
  vkUrl: string;
  vkGroupId: string;
  assignedAccount: string;
};

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

const STATUS_BADGE: Record<VkTaskStatus, string> = {
  new: "bg-gray-100 text-navy-muted",
  in_progress: "bg-blue-100 text-blue-800",
  created: "bg-emerald-100 text-emerald-800",
  filled: "bg-teal-100 text-teal-800",
  posted: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

const GROUP_FILTERS: { value: GroupFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "kp", label: "КП" },
  { value: "mnch", label: "МнЧ" },
  { value: "bt", label: "БТ" },
];

function taskToDraft(task: VkTask): TaskDraft {
  return {
    vkUrl: task.vkUrl,
    vkGroupId: task.vkGroupId,
    assignedAccount: task.assignedAccount,
  };
}

type BulkImportUpdate = {
  id: string;
  vkUrl?: string;
  vkGroupId?: string;
  assignedAccount?: string;
  status?: VkTaskStatus;
};

function parseBulkImportText(text: string): { updates: BulkImportUpdate[]; errors: string[] } {
  const updates: BulkImportUpdate[] = [];
  const errors: string[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  lines.forEach((line, index) => {
    const parts = line.split("|").map((part) => part.trim());
    const lineNo = index + 1;
    const id = parts[0] ?? "";

    if (!id) {
      errors.push(`Строка ${lineNo}: не указан id`);
      return;
    }

    const update: BulkImportUpdate = { id };

    if (parts[1]) update.vkUrl = parts[1];
    if (parts[2]) update.vkGroupId = parts[2];
    if (parts[3]) update.assignedAccount = parts[3];

    if (parts[4]) {
      if (!VK_TASK_STATUSES.includes(parts[4] as VkTaskStatus)) {
        errors.push(`Строка ${lineNo} (${id}): некорректный status "${parts[4]}"`);
        return;
      }
      update.status = parts[4] as VkTaskStatus;
    }

    if (!update.vkUrl && !update.vkGroupId && !update.assignedAccount && !update.status) {
      errors.push(`Строка ${lineNo} (${id}): нет полей для обновления`);
      return;
    }

    updates.push(update);
  });

  return { updates, errors };
}

function StatusBadge({ status }: { status: VkTaskStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
      {VK_TASK_STATUS_LABELS[status]}
    </span>
  );
}

function ActionButton({
  label,
  copied,
  onClick,
  variant = "secondary",
  disabled = false,
  className = "",
}: {
  label: string;
  copied?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-orange text-white hover:bg-orange-dark"
      : variant === "success"
        ? "bg-emerald-600 text-white hover:bg-emerald-700"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-700"
          : "border border-gray-border bg-white text-navy hover:bg-gray-card";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {copied ? "Скопировано" : label}
    </button>
  );
}

function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-gray-border bg-white p-1">
      {(
        [
          { value: "table" as const, label: "Таблица" },
          { value: "operator" as const, label: "Оператор" },
          { value: "dashboard" as const, label: "Дашборд" },
          { value: "accounts" as const, label: "Аккаунты" },
          { value: "log" as const, label: "Журнал" },
          { value: "export" as const, label: "Экспорт" },
          { value: "templates" as const, label: "Шаблоны" },
          { value: "visuals" as const, label: "Визуалы" },
          { value: "antiduplicates" as const, label: "Антидубли" },
          { value: "assignment" as const, label: "Распределение" },
        ] as const
      ).map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === item.value ? "bg-navy text-white" : "text-navy hover:bg-gray-card"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function CopyField({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
  large = false,
  mono = false,
}: {
  label: string;
  value: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  large?: boolean;
  mono?: boolean;
}) {
  return (
    <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">{label}</h3>
        <ActionButton
          label="Копировать"
          copied={copiedKey === copyKey}
          onClick={() => onCopy(value, copyKey)}
        />
      </div>
      <p
        className={`whitespace-pre-wrap break-words text-navy ${
          large ? "text-xl font-semibold sm:text-2xl" : mono ? "font-mono text-sm sm:text-base" : "text-base sm:text-lg"
        }`}
      >
        {value}
      </p>
    </section>
  );
}

export default function VkTasksTable() {
  const [tasks, setTasks] = useState<VkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [taking, setTaking] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({});
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ updated: number; notFound: string[] } | null>(null);
  const [accounts, setAccounts] = useState<VkAccountWithStats[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [taskLogEntries, setTaskLogEntries] = useState<VkTaskLogEntry[]>([]);
  const [taskLogLoading, setTaskLogLoading] = useState(false);
  const [allLogEntries, setAllLogEntries] = useState<VkTaskLogEntry[]>([]);
  const [allLogLoading, setAllLogLoading] = useState(false);

  const [regeneratingContentId, setRegeneratingContentId] = useState<string | null>(null);
  const [regeneratingVisualsId, setRegeneratingVisualsId] = useState<string | null>(null);

  const loadAllTaskLog = useCallback(async () => {
    setAllLogLoading(true);
    try {
      const res = await fetch("/api/vk-task-log");
      const data = await res.json();
      if (res.ok && data.success) {
        setAllLogEntries(data.entries as VkTaskLogEntry[]);
      } else {
        setAllLogEntries([]);
      }
    } catch {
      setAllLogEntries([]);
    } finally {
      setAllLogLoading(false);
    }
  }, []);

  const loadTaskLog = useCallback(async (taskId: string) => {
    setTaskLogLoading(true);
    try {
      const res = await fetch(`/api/vk-task-log?taskId=${encodeURIComponent(taskId)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTaskLogEntries((data.entries as VkTaskLogEntry[]).slice(0, 5));
      } else {
        setTaskLogEntries([]);
      }
    } catch {
      setTaskLogEntries([]);
    } finally {
      setTaskLogLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/vk-accounts");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить аккаунты");
      }

      setAccounts(data.accounts as VkAccountWithStats[]);
    } catch {
      setAccounts([]);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vk-tasks");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить задачи");
      }

      const nextTasks = data.tasks as VkTask[];
      setTasks(nextTasks);
      setDrafts(Object.fromEntries(nextTasks.map((task) => [task.id, taskToDraft(task)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadAccounts();
  }, [loadTasks, loadAccounts]);

  useEffect(() => {
    if (viewMode === "export") {
      loadAllTaskLog();
    }
  }, [viewMode, loadAllTaskLog]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => isAccountEligibleForAssignment(account)),
    [accounts]
  );

  useEffect(() => {
    if (selectedAccountId && !activeAccounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId("");
    }
  }, [activeAccounts, selectedAccountId]);

  const stats = useMemo(() => {
    const groups = tasks.reduce(
      (acc, task) => {
        acc[task.accountGroup] += 1;
        return acc;
      },
      { kp: 0, mnch: 0, bt: 0 } as Record<VkAccountGroup, number>
    );

    const statuses = tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<VkTaskStatus, number>
    );

    return { total: tasks.length, groups, statuses };
  }, [tasks]);

  const inProgressTasks = useMemo(() => {
    if (!selectedAccountId) return [];

    return tasks.filter(
      (task) => task.status === "in_progress" && task.assignedAccount === selectedAccountId
    );
  }, [tasks, selectedAccountId]);

  const currentOperatorTask = inProgressTasks[0] ?? null;

  useEffect(() => {
    if (currentOperatorTask) {
      loadTaskLog(currentOperatorTask.id);
    } else {
      setTaskLogEntries([]);
    }
  }, [currentOperatorTask, loadTaskLog]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const selectedAccountStats = useMemo(() => {
    if (!selectedAccountId) return null;

    const fromApi = selectedAccount?.stats;
    if (fromApi) return fromApi;

    const assigned = tasks.filter((task) => task.assignedAccount === selectedAccountId);
    return {
      total: assigned.length,
      in_progress: assigned.filter((task) => task.status === "in_progress").length,
      created: assigned.filter((task) => task.status === "created").length,
      filled: assigned.filter((task) => task.status === "filled").length,
      posted: assigned.filter((task) => task.status === "posted").length,
      error: assigned.filter((task) => task.status === "error").length,
    };
  }, [tasks, selectedAccountId, selectedAccount]);

  const accountFilterOptions = useMemo(() => {
    const ids = new Set<string>();
    activeAccounts.forEach((account) => ids.add(account.id));
    tasks.forEach((task) => {
      if (task.assignedAccount) ids.add(task.assignedAccount);
    });
    return Array.from(ids).sort();
  }, [tasks, activeAccounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tasks.filter((task) => {
      if (groupFilter !== "all" && task.accountGroup !== groupFilter) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (accountFilter !== "all" && task.assignedAccount !== accountFilter) return false;
      if (!q) return true;

      return (
        task.city.toLowerCase().includes(q) ||
        task.service.toLowerCase().includes(q) ||
        task.vkName.toLowerCase().includes(q) ||
        task.slug.toLowerCase().includes(q) ||
        task.assignedAccount.toLowerCase().includes(q)
      );
    });
  }, [tasks, query, groupFilter, statusFilter, accountFilter]);

  async function handleCopy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function saveTask(
    id: string,
    patch: Partial<
      Pick<VkTask, "vkUrl" | "assignedAccount" | "status" | "vkGroupId" | "qualityCheck" | "contentPack">
    >,
    options?: { reload?: boolean; successMessage?: string }
  ) {
    setSavingId(id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/vk-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось сохранить");
      }

      if (options?.reload) {
        await loadTasks();
      } else {
        setTasks((prev) => prev.map((task) => (task.id === id ? data.task : task)));
        setDrafts((prev) => ({ ...prev, [id]: taskToDraft(data.task as VkTask) }));
      }

      setMessage(options?.successMessage ?? "Изменения сохранены");

      if (viewMode === "operator") {
        await loadTaskLog(id);
      }

      return data.task as VkTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
      return null;
    } finally {
      setSavingId(null);
    }
  }

  function updateDraft(id: string, field: keyof TaskDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        vkUrl: field === "vkUrl" ? value : (prev[id]?.vkUrl ?? ""),
        vkGroupId: field === "vkGroupId" ? value : (prev[id]?.vkGroupId ?? ""),
        assignedAccount: field === "assignedAccount" ? value : (prev[id]?.assignedAccount ?? ""),
      },
    }));
  }

  function getDraft(task: VkTask): TaskDraft {
    return drafts[task.id] ?? taskToDraft(task);
  }

  async function handleTakeTen() {
    if (!selectedAccountId) {
      setError("Выберите active-аккаунт перед выдачей задач");
      return;
    }

    if (!activeAccounts.some((account) => account.id === selectedAccountId)) {
      setError("Выбранный аккаунт недоступен или не active");
      return;
    }

    setTaking(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/vk-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountGroup: groupFilter,
          count: 10,
          selectedAccountId,
          accountId: selectedAccountId,
          assignedAccount: selectedAccountId,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось взять задачи");
      }

      await loadTasks();
      await loadAccounts();
      setMessage(data.message || `Взято задач: ${data.count ?? 0}`);

      if (viewMode === "operator" && (data.count ?? 0) > 0) {
        setViewMode("operator");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка выдачи задач");
    } finally {
      setTaking(false);
    }
  }

  function renderAccountSelector({ required = false }: { required?: boolean } = {}) {
    if (activeAccounts.length === 0) {
      return (
        <p className="text-xs text-navy-muted">
          Нет active-аккаунтов с authStatus=connected. Подключите авторизацию во вкладке «Аккаунты».
        </p>
      );
    }

    return (
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-navy-muted">
          Аккаунт для выдачи{required ? " *" : ""}
        </span>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          required={required}
          className={`rounded-lg border bg-white px-3 py-2 text-sm ${
            required && !selectedAccountId ? "border-orange" : "border-gray-border"
          }`}
        >
          <option value="">— выберите аккаунт —</option>
          {activeAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.id}) · {account.authStatus}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function formatLogDateTime(iso: string): string {
    return new Date(iso).toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatLogStatus(value: string): string {
    if (!value) return "—";
    if (value in VK_TASK_STATUS_LABELS) {
      return VK_TASK_STATUS_LABELS[value as VkTaskStatus];
    }
    return value;
  }

  function renderOperatorTaskLog() {
    return (
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">
          Последние действия по задаче
        </h3>
        {taskLogLoading ? (
          <p className="mt-3 text-sm text-navy-muted">Загрузка...</p>
        ) : taskLogEntries.length === 0 ? (
          <p className="mt-3 text-sm text-navy-muted">Событий пока нет</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {taskLogEntries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-gray-border bg-gray-card px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-navy-muted">
                  <span>{formatLogDateTime(entry.createdAt)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 font-medium text-navy">
                    {VK_TASK_LOG_ACTION_LABELS[entry.action]}
                  </span>
                </div>
                <div className="mt-1 text-navy">
                  {entry.oldStatus || entry.newStatus
                    ? `${formatLogStatus(entry.oldStatus)} → ${formatLogStatus(entry.newStatus)}`
                    : "—"}
                </div>
                {entry.message ? (
                  <div className="mt-1 text-xs text-navy-muted">{entry.message}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  function renderOperatorAccountPanel() {
    return (
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">
              Текущий аккаунт
            </h3>
            {selectedAccount ? (
              <div>
                <p className="text-lg font-semibold text-navy">{selectedAccount.name}</p>
                <p className="font-mono text-sm text-navy-muted">{selectedAccount.id}</p>
                {selectedAccount.limits ? (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy">
                    <span>
                      Сегодня: {selectedAccount.limits.assignedToday} / {selectedAccount.dailyLimit}
                    </span>
                    <span>
                      Всего: {selectedAccount.limits.assignedTotal} / {selectedAccount.totalLimit}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-navy-muted">Аккаунт не выбран</p>
            )}
            {selectedAccountStats ? (
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-gray-card px-3 py-2">
                  <div className="text-xs text-navy-muted">Всего задач</div>
                  <div className="font-semibold text-navy">{selectedAccountStats.total}</div>
                </div>
                <div className="rounded-lg bg-gray-card px-3 py-2">
                  <div className="text-xs text-navy-muted">В работе</div>
                  <div className="font-semibold text-navy">{selectedAccountStats.in_progress}</div>
                </div>
                <div className="rounded-lg bg-gray-card px-3 py-2">
                  <div className="text-xs text-navy-muted">Создано</div>
                  <div className="font-semibold text-navy">{selectedAccountStats.created}</div>
                </div>
                <div className="rounded-lg bg-gray-card px-3 py-2">
                  <div className="text-xs text-navy-muted">Заполнено</div>
                  <div className="font-semibold text-navy">{selectedAccountStats.filled}</div>
                </div>
                <div className="rounded-lg bg-gray-card px-3 py-2">
                  <div className="text-xs text-navy-muted">Опубликовано</div>
                  <div className="font-semibold text-navy">{selectedAccountStats.posted}</div>
                </div>
                <div className="rounded-lg bg-gray-card px-3 py-2">
                  <div className="text-xs text-navy-muted">Ошибка</div>
                  <div className="font-semibold text-navy">{selectedAccountStats.error}</div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="w-full max-w-xs">{renderAccountSelector({ required: true })}</div>
        </div>
      </section>
    );
  }

  async function handleOperatorStatus(task: VkTask, status: VkTaskStatus) {
    const draft = getDraft(task);
    const qualityCheck = task.qualityCheck;

    if (status === "posted" && !canSetPostedStatus(qualityCheck)) {
      setError(getPostedBlockedMessage(qualityCheck));
      return;
    }

    await saveTask(
      task.id,
      {
        vkUrl: draft.vkUrl.trim(),
        vkGroupId: draft.vkGroupId.trim(),
        assignedAccount: draft.assignedAccount.trim(),
        qualityCheck,
        status,
      },
      {
        reload: true,
        successMessage: `Статус обновлён: ${VK_TASK_STATUS_LABELS[status]}`,
      }
    );
  }

  async function handleQualityCheckChange(
    task: VkTask,
    key: keyof VkTaskQualityCheck,
    checked: boolean
  ) {
    await saveTask(
      task.id,
      {
        qualityCheck: {
          ...task.qualityCheck,
          [key]: checked,
        },
      },
      { successMessage: "Чеклист обновлён" }
    );
  }

  function renderQualityScore(task: VkTask) {
    const score = formatQualityCheckScore(task.qualityCheck);
    const complete = isQualityCheckComplete(task.qualityCheck);

    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
          complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
        }`}
      >
        {score}
      </span>
    );
  }

  function handleOpenTaskFromDuplicates(taskId: string) {
    setQuery(taskId);
    setGroupFilter("all");
    setStatusFilter("all");
    setAccountFilter("all");
    setViewMode("table");
  }

  async function handleRegenerateContent(task: VkTask) {
    setRegeneratingContentId(task.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-tasks/regenerate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось перегенерировать контент");
      }

      const updated = data.task as VkTask;
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
      setMessage("Контент-пакет перегенерирован");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка перегенерации");
    } finally {
      setRegeneratingContentId(null);
    }
  }

  async function handleRegenerateVisuals(task: VkTask) {
    setRegeneratingVisualsId(task.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-tasks/regenerate-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось перегенерировать визуалы");
      }

      const updated = data.task as VkTask;
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
      setMessage("Визуалы перегенерированы");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка перегенерации визуалов");
    } finally {
      setRegeneratingVisualsId(null);
    }
  }

  function renderOperatorContentPack(task: VkTask) {
    const prefix = `op-${task.id}-pack`;
    const isRegenerating = regeneratingContentId === task.id;
    const isRegeneratingVisuals = regeneratingVisualsId === task.id;

    return (
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">
            Контент-пакет
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleRegenerateVisuals(task)}
              disabled={isRegeneratingVisuals || isRegenerating}
              className="rounded-lg border border-gray-border bg-gray-card px-3 py-1.5 text-xs font-medium text-navy hover:bg-white disabled:opacity-50"
            >
              {isRegeneratingVisuals ? "Генерация..." : "Перегенерировать визуалы"}
            </button>
            <button
              type="button"
              onClick={() => handleRegenerateContent(task)}
              disabled={isRegenerating || isRegeneratingVisuals}
              className="rounded-lg border border-gray-border bg-gray-card px-3 py-1.5 text-xs font-medium text-navy hover:bg-white disabled:opacity-50"
            >
              {isRegenerating ? "Генерация..." : "Перегенерировать контент"}
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {VK_CONTENT_PACK_KEYS.map((key) => (
            <CopyField
              key={key}
              label={VK_CONTENT_PACK_LABELS[key]}
              value={task.contentPack[key]}
              copyKey={`${prefix}-${key}`}
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
          ))}
        </div>
      </section>
    );
  }

  function renderOperatorQualityChecklist(task: VkTask) {
    const isSaving = savingId === task.id;
    const canPost = canSetPostedStatus(task.qualityCheck);

    return (
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">
            Чеклист качества
          </h3>
          <span className="text-sm font-medium text-navy">{formatQualityCheckScore(task.qualityCheck)}</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {VK_QUALITY_CHECK_KEYS.map((key) => {
            const required = VK_QUALITY_REQUIRED_FOR_POSTED.includes(key);

            return (
              <label
                key={key}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  task.qualityCheck[key]
                    ? "border-emerald-200 bg-emerald-50"
                    : required
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-gray-border bg-gray-card"
                }`}
              >
                <input
                  type="checkbox"
                  checked={task.qualityCheck[key]}
                  disabled={isSaving}
                  onChange={(e) => handleQualityCheckChange(task, key, e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-navy">
                  {VK_QUALITY_CHECK_LABELS[key]}
                  {required ? <span className="text-red-600"> *</span> : null}
                </span>
              </label>
            );
          })}
        </div>

        {!canPost ? (
          <p className="mt-3 text-xs text-amber-800">
            Для статуса «Опубликовано» отметьте обязательные пункты (*).
          </p>
        ) : null}
      </section>
    );
  }

  async function handleBulkImport() {
    setBulkImporting(true);
    setBulkResult(null);
    setError(null);
    setMessage(null);

    const { updates, errors } = parseBulkImportText(bulkText);

    if (errors.length > 0) {
      setError(errors.join("\n"));
      setBulkImporting(false);
      return;
    }

    if (updates.length === 0) {
      setError("Нет строк для импорта");
      setBulkImporting(false);
      return;
    }

    try {
      const res = await fetch("/api/vk-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось импортировать");
      }

      setBulkResult({ updated: data.updated, notFound: data.notFound ?? [] });
      setMessage(`Импорт завершён: обновлено ${data.updated}`);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setBulkImporting(false);
    }
  }

  function renderBulkImport() {
    return (
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Массовое обновление</h2>
        <p className="mt-1 text-sm text-navy-muted">
          Формат строки:{" "}
          <code className="rounded bg-gray-card px-1.5 py-0.5">
            id | vkUrl | vkGroupId | assignedAccount | status
          </code>
        </p>
        <p className="mt-1 text-xs text-navy-muted">
          Пустые поля не обновляются. Статус: new, in_progress, created, filled, posted, error
        </p>

        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={6}
          placeholder={`kp-abakan | https://vk.com/club123 | 123456 | account-1 | created\nkp-arkhangelsk | https://vk.com/club456 | | account-2 | filled`}
          className="mt-4 w-full rounded-xl border border-gray-border px-4 py-3 font-mono text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBulkImport}
            disabled={bulkImporting}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50"
          >
            {bulkImporting ? "Импорт..." : "Импортировать"}
          </button>
        </div>

        {bulkResult ? (
          <div className="mt-4 rounded-lg border border-gray-border bg-gray-card px-4 py-3 text-sm">
            <p className="font-medium text-navy">Обновлено: {bulkResult.updated}</p>
            {bulkResult.notFound.length > 0 ? (
              <p className="mt-2 text-red-700">
                Не найдены id: {bulkResult.notFound.join(", ")}
              </p>
            ) : (
              <p className="mt-2 text-navy-muted">Все id найдены</p>
            )}
          </div>
        ) : null}
      </section>
    );
  }

  async function handleMarkCreated(task: VkTask) {
    const draft = getDraft(task);
    await saveTask(task.id, {
      vkUrl: draft.vkUrl.trim(),
      assignedAccount: draft.assignedAccount.trim(),
      status: "created",
    });
  }

  function renderRowActions(task: VkTask) {
    const prefix = task.id;

    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton
          label="Название"
          copied={copiedKey === `${prefix}-name`}
          onClick={() => handleCopy(task.vkName, `${prefix}-name`)}
        />
        <ActionButton
          label="Описание"
          copied={copiedKey === `${prefix}-desc`}
          onClick={() => handleCopy(task.vkDescription, `${prefix}-desc`)}
        />
        <ActionButton
          label="Первый пост"
          copied={copiedKey === `${prefix}-post`}
          onClick={() => handleCopy(task.vkFirstPost, `${prefix}-post`)}
        />
        <a
          href={task.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-gray-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-gray-card"
        >
          Открыть сайт
        </a>
        {task.vkUrl ? (
          <a
            href={task.vkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100"
          >
            Открыть VK
          </a>
        ) : null}
      </div>
    );
  }

  function renderTaskFields(task: VkTask) {
    const draft = getDraft(task);
    const isSaving = savingId === task.id;

    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-muted">VK URL</label>
          <input
            type="url"
            value={draft.vkUrl}
            onChange={(e) => updateDraft(task.id, "vkUrl", e.target.value)}
            onBlur={() => {
              if (
                draft.vkUrl !== task.vkUrl ||
                draft.assignedAccount !== task.assignedAccount ||
                draft.vkGroupId !== task.vkGroupId
              ) {
                saveTask(task.id, {
                  vkUrl: draft.vkUrl.trim(),
                  assignedAccount: draft.assignedAccount.trim(),
                  vkGroupId: draft.vkGroupId.trim(),
                });
              }
            }}
            placeholder="https://vk.com/..."
            className="w-full rounded-lg border border-gray-border px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-muted">Аккаунт</label>
          <input
            type="text"
            value={draft.assignedAccount}
            onChange={(e) => updateDraft(task.id, "assignedAccount", e.target.value)}
            onBlur={() => {
              if (
                draft.vkUrl !== task.vkUrl ||
                draft.assignedAccount !== task.assignedAccount ||
                draft.vkGroupId !== task.vkGroupId
              ) {
                saveTask(task.id, {
                  vkUrl: draft.vkUrl.trim(),
                  assignedAccount: draft.assignedAccount.trim(),
                  vkGroupId: draft.vkGroupId.trim(),
                });
              }
            }}
            placeholder="vk-account-1"
            className="w-full rounded-lg border border-gray-border px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
        </div>
        <ActionButton
          label="Создано"
          variant="success"
          disabled={isSaving}
          onClick={() => handleMarkCreated(task)}
        />
      </div>
    );
  }

  function renderOperatorMode() {
    if (!currentOperatorTask) {
      return (
        <div className="space-y-5">
          {renderOperatorAccountPanel()}

          <div className="rounded-2xl border border-dashed border-gray-border bg-gray-card px-6 py-12 text-center">
            <h2 className="text-xl font-semibold text-navy">Нет задач в работе</h2>
            <p className="mt-2 text-navy-muted">
              Выберите аккаунт и возьмите пачку из 10 задач для ручного создания сообществ.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <div className="flex flex-wrap justify-center gap-2">
                {GROUP_FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setGroupFilter(item.value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium ${
                      groupFilter === item.value
                        ? "bg-navy text-white"
                        : "bg-white text-navy border border-gray-border"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleTakeTen}
                disabled={taking || !selectedAccountId}
                className="rounded-xl bg-orange px-6 py-3 text-sm font-semibold text-white hover:bg-orange-dark disabled:opacity-50"
              >
                {taking ? "Выдача..." : "Взять 10 задач"}
              </button>
            </div>
            <p className="mt-4 text-sm text-navy-muted">
              Новых задач: {stats.statuses.new ?? 0}
            </p>
          </div>
        </div>
      );
    }

    const task = currentOperatorTask;
    const draft = getDraft(task);
    const isSaving = savingId === task.id;
    const prefix = `op-${task.id}`;

    return (
      <div className="space-y-5">
        {renderOperatorAccountPanel()}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-border bg-gray-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${GROUP_BADGE[task.accountGroup]}`}>
              {GROUP_LABELS[task.accountGroup]}
            </span>
            <StatusBadge status={task.status} />
            <span className="text-sm text-navy-muted">
              В работе: {inProgressTasks.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleTakeTen}
            disabled={taking || !selectedAccountId}
            className="rounded-lg border border-gray-border bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-card disabled:opacity-50"
          >
            {taking ? "Выдача..." : "Взять ещё 10"}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">Город</h3>
            <p className="mt-2 text-xl font-semibold text-navy sm:text-2xl">{task.city}</p>
          </section>
          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">Услуга</h3>
            <p className="mt-2 text-xl font-semibold text-navy sm:text-2xl">{task.service}</p>
          </section>
        </div>

        <CopyField
          label="Название VK"
          value={task.vkName}
          copyKey={`${prefix}-name`}
          copiedKey={copiedKey}
          onCopy={handleCopy}
          large
        />

        <CopyField
          label="Описание"
          value={task.vkDescription}
          copyKey={`${prefix}-desc`}
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />

        <CopyField
          label="Первый пост"
          value={task.vkFirstPost}
          copyKey={`${prefix}-post`}
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <CopyField
            label="Сайт"
            value={task.siteUrl}
            copyKey={`${prefix}-site`}
            copiedKey={copiedKey}
            onCopy={handleCopy}
            mono
          />
          <CopyField
            label="Телефон"
            value={task.phone}
            copyKey={`${prefix}-phone`}
            copiedKey={copiedKey}
            onCopy={handleCopy}
            mono
          />
        </div>

        <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">Slug</h3>
          <p className="mt-2 font-mono text-base text-navy sm:text-lg">{task.slug}</p>
        </section>

        <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-muted">
            Данные сообщества
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-muted">VK URL</label>
              <input
                type="url"
                value={draft.vkUrl}
                onChange={(e) => updateDraft(task.id, "vkUrl", e.target.value)}
                placeholder="https://vk.com/..."
                className="w-full rounded-lg border border-gray-border px-3 py-2.5 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-muted">VK Group ID</label>
              <input
                type="text"
                value={draft.vkGroupId}
                onChange={(e) => updateDraft(task.id, "vkGroupId", e.target.value)}
                placeholder="123456789"
                className="w-full rounded-lg border border-gray-border px-3 py-2.5 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-muted">Аккаунт</label>
              <input
                type="text"
                value={draft.assignedAccount}
                onChange={(e) => updateDraft(task.id, "assignedAccount", e.target.value)}
                placeholder="vk-account-1"
                className="w-full rounded-lg border border-gray-border px-3 py-2.5 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            </div>
          </div>
        </section>

        {renderOperatorContentPack(task)}

        {renderOperatorQualityChecklist(task)}

        <section className="rounded-xl border border-gray-border bg-gray-card p-4 sm:p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-muted">
            Статус задачи
          </h3>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              label="Создано"
              variant="success"
              className="px-4 py-2.5 text-sm"
              disabled={isSaving}
              onClick={() => handleOperatorStatus(task, "created")}
            />
            <ActionButton
              label="Заполнено"
              variant="primary"
              className="px-4 py-2.5 text-sm"
              disabled={isSaving}
              onClick={() => handleOperatorStatus(task, "filled")}
            />
            <ActionButton
              label="Пост опубликован"
              variant="secondary"
              className="px-4 py-2.5 text-sm"
              disabled={isSaving || !canSetPostedStatus(task.qualityCheck)}
              onClick={() => handleOperatorStatus(task, "posted")}
            />
            <ActionButton
              label="Ошибка"
              variant="danger"
              className="px-4 py-2.5 text-sm"
              disabled={isSaving}
              onClick={() => handleOperatorStatus(task, "error")}
            />
          </div>
        </section>

        {renderOperatorTaskLog()}

        <div className="flex flex-wrap gap-3">
          <a
            href={task.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-gray-card"
          >
            Открыть сайт
          </a>
          {draft.vkUrl || task.vkUrl ? (
            <a
              href={draft.vkUrl || task.vkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
            >
              Открыть VK
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  function renderTableMode() {
    return (
      <>
        <div className="flex flex-col gap-3 rounded-xl border border-gray-border bg-gray-card p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px]">{renderAccountSelector()}</div>
            <button
              type="button"
              onClick={handleTakeTen}
              disabled={taking || !selectedAccountId}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-light disabled:opacity-50"
            >
              {taking ? "Выдача..." : "Взять 10 задач"}
            </button>
            <span className="self-center text-xs text-navy-muted">
              Новых: {stats.statuses.new ?? 0} · В работе: {stats.statuses.in_progress ?? 0}
            </span>
          </div>
          <div className="text-sm text-navy-muted">
            Показано: <strong className="text-navy">{filtered.length}</strong> из {tasks.length}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {GROUP_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setGroupFilter(item.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  groupFilter === item.value
                    ? "bg-navy text-white"
                    : "bg-gray-card text-navy hover:bg-gray-border/60"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                statusFilter === "all" ? "bg-orange text-white" : "bg-white text-navy border border-gray-border"
              }`}
            >
              Все статусы
            </button>
            {VK_TASK_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  statusFilter === status ? "bg-orange text-white" : "bg-white text-navy border border-gray-border"
                }`}
              >
                {VK_TASK_STATUS_LABELS[status]} ({stats.statuses[status] ?? 0})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-navy-muted">Аккаунт:</span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-lg border border-gray-border bg-white px-3 py-1.5 text-xs"
            >
              <option value="all">Все аккаунты</option>
              {accountFilterOptions.map((accountId) => (
                <option key={accountId} value={accountId}>
                  {accounts.find((account) => account.id === accountId)?.name ?? accountId}
                </option>
              ))}
            </select>
          </div>
        </div>

        <input
          type="search"
          placeholder="Поиск по городу, услуге, названию VK, slug или аккаунту..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-border bg-white px-4 py-2.5 text-sm outline-none ring-orange/30 placeholder:text-navy-muted/60 focus:border-orange focus:ring-2"
        />

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
            Ничего не найдено.
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
                    <th className="px-3 py-3 font-medium">Качество</th>
                    <th className="px-3 py-3 font-medium min-w-[220px]">VK / Аккаунт</th>
                    <th className="px-3 py-3 font-medium min-w-[280px]">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task) => (
                    <tr key={task.id} className="border-t border-gray-border align-top hover:bg-gray-card/50">
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${GROUP_BADGE[task.accountGroup]}`}>
                          {GROUP_LABELS[task.accountGroup]}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{task.city}</td>
                      <td className="px-3 py-3">{task.service}</td>
                      <td className="px-3 py-3 font-medium">{task.vkName}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{task.phone}</td>
                      <td className="px-3 py-3 max-w-[180px]">
                        <a href={task.siteUrl} target="_blank" rel="noopener noreferrer" className="break-all text-orange hover:underline">
                          {task.siteUrl.replace(/^https?:\/\//, "")}
                        </a>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-3 py-3">{renderQualityScore(task)}</td>
                      <td className="px-3 py-3">{renderTaskFields(task)}</td>
                      <td className="px-3 py-3">{renderRowActions(task)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 lg:hidden">
              {filtered.map((task) => (
                <article key={task.id} className="rounded-xl border border-gray-border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${GROUP_BADGE[task.accountGroup]}`}>
                        {GROUP_LABELS[task.accountGroup]}
                      </span>
                      <h2 className="mt-2 text-base font-semibold text-navy">{task.vkName}</h2>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>

                  <div className="mt-3">{renderQualityScore(task)}</div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-navy-muted">Город</dt>
                      <dd>{task.city}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-navy-muted">Услуга</dt>
                      <dd>{task.service}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-navy-muted">Сайт</dt>
                      <dd>
                        <a href={task.siteUrl} target="_blank" rel="noopener noreferrer" className="text-orange hover:underline">
                          {task.siteUrl.replace(/^https?:\/\//, "")}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 border-t border-gray-border pt-4">{renderTaskFields(task)}</div>
                  <div className="mt-4 border-t border-gray-border pt-4">{renderRowActions(task)}</div>
                </article>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  async function handleBatchAssigned() {
    await loadTasks();
    await loadAccounts();
  }

  if (loading && viewMode !== "accounts" && viewMode !== "log" && viewMode !== "dashboard" && viewMode !== "export" && viewMode !== "templates" && viewMode !== "visuals" && viewMode !== "antiduplicates" && viewMode !== "assignment") {
    return (
      <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
        Загрузка задач...
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ModeSwitcher mode={viewMode} onChange={setViewMode} />
        {viewMode !== "accounts" && viewMode !== "log" && viewMode !== "dashboard" && viewMode !== "export" && viewMode !== "templates" && viewMode !== "visuals" && viewMode !== "antiduplicates" && viewMode !== "assignment" ? (
          <div className="text-sm text-navy-muted">
            В работе: <strong className="text-navy">{stats.statuses.in_progress ?? 0}</strong>
            {" · "}
            Новых: <strong className="text-navy">{stats.statuses.new ?? 0}</strong>
          </div>
        ) : null}
      </div>

      {(error || message) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      {viewMode === "accounts" ? (
        <VkAccountsPanel />
      ) : viewMode === "log" ? (
        <VkTaskLogPanel />
      ) : viewMode === "dashboard" ? (
        <VkDashboardPanel />
      ) : viewMode === "export" ? (
        <VkExportPanel
          tasks={tasks}
          accounts={accounts}
          log={allLogEntries}
          logLoading={allLogLoading}
          onReloadLog={loadAllTaskLog}
        />
      ) : viewMode === "templates" ? (
        <VkTemplatesPanel />
      ) : viewMode === "visuals" ? (
        <VkVisualTemplatesPanel />
      ) : viewMode === "antiduplicates" ? (
        <VkAntiDuplicatePanel
          tasks={tasks}
          onOpenTask={handleOpenTaskFromDuplicates}
          onTasksUpdated={loadTasks}
        />
      ) : viewMode === "assignment" ? (
        <VkBatchAssignPanel tasks={tasks} onAssigned={handleBatchAssigned} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Всего", value: stats.total },
              { label: "КП", value: stats.groups.kp },
              { label: "МнЧ", value: stats.groups.mnch },
              { label: "БТ", value: stats.groups.bt },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-border bg-gray-card px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-navy-muted">{item.label}</div>
                <div className="mt-1 text-2xl font-bold text-navy">{item.value}</div>
              </div>
            ))}
          </div>

          {renderBulkImport()}

          {viewMode === "operator" ? renderOperatorMode() : renderTableMode()}
        </>
      )}
    </div>
  );
}
