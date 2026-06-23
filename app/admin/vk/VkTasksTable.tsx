"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VkAccountWithStats } from "@/lib/vk-account-types";
import { isAccountEligibleForAssignment } from "@/lib/vk-account-auth";
import type { VkAccountGroup } from "@/lib/vk-types";
import type { VkTask, VkTaskStatus } from "@/lib/vk-task-types";
import { VK_TASK_STATUS_LABELS, VK_TASK_STATUSES } from "@/lib/vk-task-types";
import type { VkTaskStatusSnapshot } from "@/lib/vk-task-status-types";
import type { VkUrlBindBatchSummary } from "@/lib/vk-url-bind-batches-types";
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
import { getImageAssetsIndicators } from "@/lib/vk-image-assets-types";
import {
  formatManualSetupScore,
  getManualSetupWarning,
  isManualSetupPrepared,
  VK_GROUP_PREP_CHECKLIST_KEYS,
  VK_MANUAL_SETUP_LABELS,
  type VkTaskManualSetup,
} from "@/lib/vk-manual-setup";
import VkAccountsPanel from "./VkAccountsPanel";
import VkTaskLogPanel from "./VkTaskLogPanel";
import VkDashboardPanel from "./VkDashboardPanel";
import VkExportPanel from "./VkExportPanel";
import VkTemplatesPanel from "./VkTemplatesPanel";
import VkVisualTemplatesPanel from "./VkVisualTemplatesPanel";
import VkAntiDuplicatePanel from "./VkAntiDuplicatePanel";
import VkBatchAssignPanel from "./VkBatchAssignPanel";
import VkAutomationPanel from "./VkAutomationPanel";
import VkApiDiagnosticsPanel from "./VkApiDiagnosticsPanel";
import VkImagesPanel from "./VkImagesPanel";
import VkGroupBindingPanel from "./VkGroupBindingPanel";
import VkGroupPrepPanel from "./VkGroupPrepPanel";
import VkServicePanel from "./VkServicePanel";
import VkTaskImagesBlock from "./VkTaskImagesBlock";

type ViewMode = "table" | "operator" | "accounts" | "log" | "dashboard" | "export" | "templates" | "visuals" | "images" | "groupprep" | "groupbinding" | "service" | "antiduplicates" | "assignment" | "automation" | "diagnostics";
type GroupFilter = "all" | VkAccountGroup;
type StatusFilter = "all" | VkTaskStatus | "vk_url_no_group_id";
type HasVkGroupIdFilter = "all" | "yes" | "no";
type StrictReadyFilter = "all" | "strict_ready";

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
  need_vk_url: "bg-amber-100 text-amber-900",
  created: "bg-emerald-100 text-emerald-800",
  ready_for_worker: "bg-teal-100 text-teal-900",
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

type BulkImportMode = "by_id" | "auto_bind";

function isVkUrlWithoutGroupId(task: Pick<VkTask, "vkUrl" | "vkGroupId">): boolean {
  return task.vkUrl.trim().length > 0 && !task.vkGroupId.trim();
}

type AutoBindResultSummary = {
  linksTotal: number;
  tasksUpdated: number;
  bound: Array<{ taskId: string; vkUrl: string; vkGroupId: string }>;
  notAssigned: string[];
  notRecognized: Array<{ vkUrl: string; error: string }>;
  errors: string[];
  batchId?: string;
  updatedTaskIds?: string[];
};

type BulkImportUpdate = {
  id: string;
  vkUrl?: string;
  vkGroupId?: string;
  assignedAccount?: string;
  status?: VkTaskStatus;
};

function looksLikeVkUrl(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("vk.com") ||
    lower.startsWith("club") ||
    lower.startsWith("public") ||
    lower.startsWith("event") ||
    lower.startsWith("@")
  );
}

function parseBulkImportText(
  text: string,
  mode: "by_id" | "auto_bind" = "by_id"
): {
  updates: BulkImportUpdate[];
  unparsedUrls: string[];
  autoBindUrls: string[];
  errors: string[];
} {
  const updates: BulkImportUpdate[] = [];
  const unparsedUrls: string[] = [];
  const autoBindUrls: string[] = [];
  const errors: string[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (mode === "auto_bind") {
    lines.forEach((line, index) => {
      if (!looksLikeVkUrl(line)) {
        errors.push(`Строка ${index + 1}: ожидается VK-ссылка`);
        return;
      }
      autoBindUrls.push(line);
    });
    return { updates, unparsedUrls, autoBindUrls, errors };
  }

  lines.forEach((line, index) => {
    const parts = line.split("|").map((part) => part.trim());
    const lineNo = index + 1;

    if (!line.includes("|") && looksLikeVkUrl(line)) {
      errors.push(`Строка ${lineNo}: только vkUrl — переключитесь на режим «Автопривязка ссылок»`);
      return;
    }

    const id = parts[0] ?? "";

    if (!id) {
      errors.push(`Строка ${lineNo}: не указан id`);
      return;
    }

    const update: BulkImportUpdate = { id };

    if (parts.length >= 5) {
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
    } else if (parts.length === 4) {
      const maybeStatus = parts[3];
      if (maybeStatus && VK_TASK_STATUSES.includes(maybeStatus as VkTaskStatus)) {
        if (parts[1]) update.vkUrl = parts[1];
        if (parts[2]) update.assignedAccount = parts[2];
        update.status = maybeStatus as VkTaskStatus;
      } else if (looksLikeVkUrl(parts[1] ?? "")) {
        if (parts[1]) update.vkUrl = parts[1];
        if (parts[2]) update.vkGroupId = parts[2];
        if (parts[3]) update.assignedAccount = parts[3];
      } else {
        if (parts[1]) update.vkUrl = parts[1];
        if (parts[2]) update.assignedAccount = parts[2];
        if (parts[3]) update.status = parts[3] as VkTaskStatus;
      }
    } else if (parts.length === 3) {
      if (parts[1]) update.vkUrl = parts[1];
      if (parts[2]) update.assignedAccount = parts[2];
    } else {
      if (parts[1]) update.vkUrl = parts[1];
    }

    if (!update.vkUrl && !update.vkGroupId && !update.assignedAccount && !update.status) {
      errors.push(`Строка ${lineNo} (${id}): нет полей для обновления`);
      return;
    }

    updates.push(update);
  });

  return { updates, unparsedUrls, autoBindUrls, errors };
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
          { value: "images" as const, label: "Изображения" },
          { value: "groupprep" as const, label: "Подготовка группы" },
          { value: "groupbinding" as const, label: "Привязка групп" },
          { value: "service" as const, label: "Настройки / Сервис" },
          { value: "antiduplicates" as const, label: "Антидубли" },
          { value: "assignment" as const, label: "Распределение" },
          { value: "automation" as const, label: "Автоматизация" },
          { value: "diagnostics" as const, label: "Диагностика VK API" },
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
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveFeedback, setResolveFeedback] = useState<
    Record<string, { type: "success" | "error"; message: string }>
  >({});
  const [taking, setTaking] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [imagesFocusTaskId, setImagesFocusTaskId] = useState("");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({});
  const [bulkText, setBulkText] = useState("");
  const [bulkImportMode, setBulkImportMode] = useState<BulkImportMode>("by_id");
  const [bulkAutoBindAccountId, setBulkAutoBindAccountId] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    updated: number;
    notFound: string[];
    resolveWarnings?: string[];
    unparsedAdded?: number;
    autoBind?: AutoBindResultSummary;
  } | null>(null);
  const [unparsedUrls, setUnparsedUrls] = useState<Array<{ id: string; vkUrl: string; addedAt: string }>>(
    []
  );
  const [unparsedLoading, setUnparsedLoading] = useState(false);
  const [bindText, setBindText] = useState("");
  const [bindAccountId, setBindAccountId] = useState("");
  const [binding, setBinding] = useState(false);
  const [bindResult, setBindResult] = useState<{
    bound: number;
    skipped: number;
    errors: string[];
    batchId?: string;
    updatedTaskIds?: string[];
  } | null>(null);
  const [lastBindBatch, setLastBindBatch] = useState<VkUrlBindBatchSummary | null>(null);
  const [bindBatches, setBindBatches] = useState<VkUrlBindBatchSummary[]>([]);
  const [bindBatchFilter, setBindBatchFilter] = useState<string>("all");
  const [queueFromBatchBusy, setQueueFromBatchBusy] = useState(false);
  const [accounts, setAccounts] = useState<VkAccountWithStats[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [hasVkGroupIdFilter, setHasVkGroupIdFilter] = useState<HasVkGroupIdFilter>("all");
  const [strictReadyFilter, setStrictReadyFilter] = useState<StrictReadyFilter>("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [queueForSelectedBusy, setQueueForSelectedBusy] = useState(false);
  const [taskLogEntries, setTaskLogEntries] = useState<VkTaskLogEntry[]>([]);
  const [taskLogLoading, setTaskLogLoading] = useState(false);
  const [allLogEntries, setAllLogEntries] = useState<VkTaskLogEntry[]>([]);
  const [allLogLoading, setAllLogLoading] = useState(false);
  const [taskStatusSnapshot, setTaskStatusSnapshot] = useState<VkTaskStatusSnapshot | null>(null);

  const [regeneratingContentId, setRegeneratingContentId] = useState<string | null>(null);
  const [regeneratingVisualsId, setRegeneratingVisualsId] = useState<string | null>(null);

  const loadUnparsedUrls = useCallback(async () => {
    setUnparsedLoading(true);
    try {
      const res = await fetch("/api/vk-unparsed-urls");
      const data = await res.json();
      if (res.ok && data.success) {
        setUnparsedUrls(data.items ?? []);
      }
    } catch {
      setUnparsedUrls([]);
    } finally {
      setUnparsedLoading(false);
    }
  }, []);

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

  const loadBindBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/vk-url-bind-batches");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.batches)) {
        setBindBatches(data.batches as VkUrlBindBatchSummary[]);
      }
    } catch {
      setBindBatches([]);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tasksRes, statusRes] = await Promise.all([
        fetch("/api/vk-tasks"),
        fetch("/api/vk-task-status"),
      ]);
      const data = await tasksRes.json();
      const statusData = await statusRes.json();

      if (!tasksRes.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить задачи");
      }

      const nextTasks = data.tasks as VkTask[];
      setTasks(nextTasks);
      setDrafts(Object.fromEntries(nextTasks.map((task) => [task.id, taskToDraft(task)])));

      if (statusRes.ok && statusData.success && statusData.status) {
        setTaskStatusSnapshot(statusData.status as VkTaskStatusSnapshot);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadAccounts();
    loadUnparsedUrls();
    loadBindBatches();
  }, [loadTasks, loadAccounts, loadUnparsedUrls, loadBindBatches]);

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

    return tasks
      .filter(
        (task) =>
          (task.status === "in_progress" || task.status === "need_vk_url") &&
          task.assignedAccount === selectedAccountId
      )
      .sort((a, b) => {
        if (a.status === "need_vk_url" && b.status !== "need_vk_url") return -1;
        if (b.status === "need_vk_url" && a.status !== "need_vk_url") return 1;
        return (a.assignedAt || a.updatedAt).localeCompare(b.assignedAt || b.updatedAt);
      });
  }, [tasks, selectedAccountId]);

  const needVkUrlTasks = useMemo(() => {
    return tasks.filter((task) => task.status === "need_vk_url");
  }, [tasks]);

  const needVkUrlTasksForAccount = useMemo(() => {
    if (!bindAccountId) return [];
    return needVkUrlTasks.filter((task) => task.assignedAccount === bindAccountId);
  }, [needVkUrlTasks, bindAccountId]);

  const autoBindCandidatesForAccount = useMemo(() => {
    if (!bulkAutoBindAccountId) return [];
    return tasks.filter(
      (task) =>
        (task.status === "in_progress" || task.status === "created") &&
        task.assignedAccount === bulkAutoBindAccountId &&
        !task.vkUrl.trim() &&
        !task.vkGroupId.trim()
    );
  }, [tasks, bulkAutoBindAccountId]);

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
      need_vk_url: assigned.filter((task) => task.status === "need_vk_url").length,
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

  const vkUrlNoGroupCount = taskStatusSnapshot?.vkUrlNoGroupId ?? 0;
  const vkUrlNoGroupIdSet = useMemo(
    () => new Set(taskStatusSnapshot?.vkUrlNoGroupIdTaskIds ?? []),
    [taskStatusSnapshot]
  );
  const strictReadyTaskIdSet = useMemo(
    () => new Set(taskStatusSnapshot?.strictReadyTaskIds ?? []),
    [taskStatusSnapshot]
  );
  const strictReadyCount = taskStatusSnapshot?.readyForWorkerStrict ?? 0;

  const bindBatchFilterOptions = useMemo(() => {
    const ids = new Set<string>();
    bindBatches.forEach((batch) => ids.add(batch.batchId));
    tasks.forEach((task) => {
      if (task.lastBindBatchId.trim()) ids.add(task.lastBindBatchId.trim());
    });
    return Array.from(ids).sort((a, b) => b.localeCompare(a));
  }, [bindBatches, tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tasks.filter((task) => {
      if (groupFilter !== "all" && task.accountGroup !== groupFilter) return false;
      if (statusFilter === "vk_url_no_group_id") {
        if (vkUrlNoGroupIdSet.size > 0) {
          if (!vkUrlNoGroupIdSet.has(task.id)) return false;
        } else if (!isVkUrlWithoutGroupId(task)) {
          return false;
        }
      } else if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }
      if (accountFilter !== "all" && task.assignedAccount !== accountFilter) return false;
      if (hasVkGroupIdFilter === "yes" && !task.vkGroupId.trim()) return false;
      if (hasVkGroupIdFilter === "no" && task.vkGroupId.trim()) return false;
      if (strictReadyFilter === "strict_ready") {
        if (strictReadyTaskIdSet.size > 0) {
          if (!strictReadyTaskIdSet.has(task.id)) return false;
        } else if (task.status !== "ready_for_worker" || !task.vkGroupId.trim()) {
          return false;
        }
      }
      if (bindBatchFilter !== "all" && task.lastBindBatchId.trim() !== bindBatchFilter) {
        return false;
      }
      if (!q) return true;

      return (
        task.city.toLowerCase().includes(q) ||
        task.service.toLowerCase().includes(q) ||
        task.vkName.toLowerCase().includes(q) ||
        task.slug.toLowerCase().includes(q) ||
        task.assignedAccount.toLowerCase().includes(q) ||
        task.id.toLowerCase().includes(q)
      );
    });
  }, [
    tasks,
    query,
    groupFilter,
    statusFilter,
    accountFilter,
    hasVkGroupIdFilter,
    strictReadyFilter,
    vkUrlNoGroupIdSet,
    strictReadyTaskIdSet,
    bindBatchFilter,
  ]);

  async function createQueueForBindBatch(batchId: string) {
    if (
      !confirm(
        `Очистить очередь и создать pipeline только для привязки ${batchId}?`
      )
    ) {
      return;
    }

    setQueueFromBatchBusy(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-automation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_and_generate_bind_batch", batchId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Не удалось создать очередь по привязке");
      }

      const errors = Array.isArray(data.errors)
        ? (data.errors as string[]).filter((item) => typeof item === "string" && item.trim())
        : [];

      if (errors.length > 0) {
        setError(errors.join("; "));
      } else {
        setError(null);
      }

      setMessage(typeof data.message === "string" ? data.message : "Очередь создана по привязке");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания очереди");
    } finally {
      setQueueFromBatchBusy(false);
    }
  }

  function renderBindBatchPanel(batch: Pick<VkUrlBindBatchSummary, "batchId" | "taskIds" | "tasksUpdated">) {
    return (
      <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-3 text-sm">
        <p className="font-medium text-teal-900">
          batchId: <code className="text-xs">{batch.batchId}</code>
        </p>
        <p className="mt-1 text-xs text-teal-800">
          Обновлено задач: {batch.tasksUpdated ?? batch.taskIds.length}
        </p>
        {batch.taskIds.length > 0 ? (
          <p className="mt-1 font-mono text-xs text-teal-900 break-all">{batch.taskIds.join(", ")}</p>
        ) : null}
        <button
          type="button"
          onClick={() => createQueueForBindBatch(batch.batchId)}
          disabled={queueFromBatchBusy}
          className="mt-2 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {queueFromBatchBusy ? "..." : "Создать очередь по этой привязке"}
        </button>
      </div>
    );
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((task) => selectedTaskIds.has(task.id));

  function toggleTaskSelected(taskId: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((task) => next.delete(task.id));
      } else {
        filtered.forEach((task) => next.add(task.id));
      }
      return next;
    });
  }

  async function handleGenerateQueueForSelected() {
    const taskIds = Array.from(selectedTaskIds);
    if (taskIds.length === 0) {
      setError("Выберите хотя бы одну задачу");
      return;
    }

    if (
      !confirm(
        `Очистить очередь и создать pipeline только для ${taskIds.length} выбранных задач?`
      )
    ) {
      return;
    }

    setQueueForSelectedBusy(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-automation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_selected", taskIds }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Не удалось сформировать очередь");
      }

      if (data.stats) {
        // queue stats not shown in tasks table — message only
      }

      const errors = Array.isArray(data.errors)
        ? (data.errors as string[]).filter((item) => typeof item === "string" && item.trim())
        : [];

      if (errors.length > 0) {
        setError(errors.join("; "));
      } else {
        setError(null);
      }

      setMessage(typeof data.message === "string" ? data.message : "Очередь сформирована");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка формирования очереди");
    } finally {
      setQueueForSelectedBusy(false);
    }
  }

  async function handleCopy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function saveTask(
    id: string,
    patch: Partial<
      Pick<
        VkTask,
        "vkUrl" | "assignedAccount" | "status" | "vkGroupId" | "qualityCheck" | "manualSetup" | "contentPack"
      >
    >,
    options?: { reload?: boolean; successMessage?: string; markManualCreated?: boolean }
  ) {
    setSavingId(id);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/vk-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...patch,
          ...(options?.markManualCreated ? { markManualCreated: true } : {}),
        }),
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
                  <div className="text-xs text-navy-muted">Нужна VK ссылка</div>
                  <div className="font-semibold text-navy">{selectedAccountStats.need_vk_url ?? 0}</div>
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

  async function handleManualSetupChange(
    task: VkTask,
    key: keyof VkTaskManualSetup,
    checked: boolean
  ) {
    await saveTask(
      task.id,
      {
        manualSetup: {
          ...task.manualSetup,
          [key]: checked,
        },
      },
      { successMessage: "Ручная настройка обновлена" }
    );
  }

  function renderManualSetupBlock(task: VkTask, compact = false) {
    const isSaving = savingId === task.id;
    const complete = isManualSetupPrepared(task.manualSetup);
    const warning = getManualSetupWarning(task.manualSetup);

    if (compact) {
      return (
        <div className="space-y-1.5 text-xs text-navy min-w-[180px]">
          <div className={complete ? "font-medium text-emerald-700" : "font-medium text-amber-800"}>
            {formatManualSetupScore(task.manualSetup)}
          </div>
          {VK_GROUP_PREP_CHECKLIST_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={task.manualSetup[key]}
                disabled={isSaving}
                onChange={(e) => handleManualSetupChange(task, key, e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-border"
              />
              <span>{VK_MANUAL_SETUP_LABELS[key]}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">
            Ручная настройка группы
          </h3>
          <span className="text-sm font-medium text-navy">{formatManualSetupScore(task.manualSetup)}</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {VK_GROUP_PREP_CHECKLIST_KEYS.map((key) => (
            <label
              key={key}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                task.manualSetup[key]
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50/50"
              }`}
            >
              <input
                type="checkbox"
                checked={task.manualSetup[key]}
                disabled={isSaving}
                onChange={(e) => handleManualSetupChange(task, key, e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-navy">{VK_MANUAL_SETUP_LABELS[key]}</span>
            </label>
          ))}
        </div>

        {warning ? (
          <p className="mt-3 text-xs text-amber-800">{warning}. Worker (Posts Only) всё равно может быть запущен.</p>
        ) : null}
      </section>
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

  function renderImageAssetsIndicators(task: VkTask) {
    const indicators = getImageAssetsIndicators(task.imageAssets);

    return (
      <div className="space-y-1 text-xs text-navy">
        <div>avatar {indicators.avatar}</div>
        <div>cover {indicators.cover}</div>
        <div>posts {indicators.posts}</div>
      </div>
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

    const { updates, unparsedUrls: parsedUnparsed, autoBindUrls, errors } = parseBulkImportText(
      bulkText,
      bulkImportMode
    );

    if (errors.length > 0) {
      setError(errors.join("\n"));
      setBulkImporting(false);
      return;
    }

    if (bulkImportMode === "auto_bind") {
      if (!bulkAutoBindAccountId.trim()) {
        setError("Выберите аккаунт для автопривязки");
        setBulkImporting(false);
        return;
      }

      if (autoBindUrls.length === 0) {
        setError("Вставьте VK-ссылки (по одной на строку)");
        setBulkImporting(false);
        return;
      }

      try {
        const res = await fetch("/api/vk-tasks/bind-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: bulkAutoBindAccountId.trim(),
            urls: autoBindUrls,
            mode: "auto",
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Не удалось выполнить автопривязку");
        }

        const result = data.result as AutoBindResultSummary & { skipped?: string[]; batch?: VkUrlBindBatchSummary };

        if (result.batch) {
          setLastBindBatch(result.batch);
        } else if (result.batchId) {
          setLastBindBatch({
            batchId: result.batchId,
            createdAt: new Date().toISOString(),
            accountId: bulkAutoBindAccountId.trim(),
            mode: "auto",
            linksTotal: result.linksTotal,
            tasksUpdated: result.tasksUpdated,
            taskIds: result.updatedTaskIds ?? result.bound.map((item) => item.taskId),
          });
        }

        setBulkResult({
          updated: 0,
          notFound: [],
          autoBind: {
            linksTotal: result.linksTotal,
            tasksUpdated: result.tasksUpdated,
            bound: result.bound,
            notAssigned: result.notAssigned ?? result.skipped ?? [],
            notRecognized: result.notRecognized ?? [],
            errors: result.errors ?? [],
            batchId: result.batchId,
            updatedTaskIds: result.updatedTaskIds ?? result.bound.map((item) => item.taskId),
          },
        });
        setMessage(
          data.message ||
            `Автопривязка: ${result.tasksUpdated} из ${result.linksTotal} ссылок → задачи (ready_for_worker)`
        );
        await loadTasks();
        await loadBindBatches();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка автопривязки");
      } finally {
        setBulkImporting(false);
      }
      return;
    }

    if (updates.length === 0 && parsedUnparsed.length === 0) {
      setError("Нет строк для импорта");
      setBulkImporting(false);
      return;
    }

    try {
      let unparsedAdded = 0;

      if (parsedUnparsed.length > 0) {
        const unparsedRes = await fetch("/api/vk-unparsed-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: parsedUnparsed }),
        });
        const unparsedData = await unparsedRes.json();
        if (!unparsedRes.ok || !unparsedData.success) {
          throw new Error(unparsedData.error || "Не удалось добавить ссылки в очередь");
        }
        unparsedAdded = unparsedData.added ?? parsedUnparsed.length;
        await loadUnparsedUrls();
      }

      let updated = 0;
      let notFound: string[] = [];
      let resolveWarnings: string[] = [];

      if (updates.length > 0) {
        const res = await fetch("/api/vk-tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Не удалось импортировать");
        }

        updated = data.updated;
        notFound = data.notFound ?? [];
        resolveWarnings = data.resolveWarnings ?? [];
        await loadTasks();
      }

      setBulkResult({ updated, notFound, resolveWarnings, unparsedAdded });
      const parts: string[] = [];
      if (updated > 0) parts.push(`обновлено ${updated}`);
      if (unparsedAdded > 0) parts.push(`в очередь ${unparsedAdded}`);
      setMessage(parts.length > 0 ? `Импорт завершён: ${parts.join(", ")}` : "Импорт завершён");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setBulkImporting(false);
    }
  }

  async function handleBindUrls(options?: { useUnparsedQueue?: boolean; urls?: string[] }) {
    const accountId = bindAccountId.trim();
    if (!accountId) {
      setError("Выберите аккаунт для привязки");
      return;
    }

    const urls =
      options?.urls ??
      bindText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

    if (urls.length === 0 && !options?.useUnparsedQueue) {
      setError("Вставьте ссылки VK для привязки");
      return;
    }

    setBinding(true);
    setBindResult(null);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-tasks/bind-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          urls,
          useUnparsedQueue: options?.useUnparsedQueue === true,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось привязать ссылки");
      }

      const result = data.result as AutoBindResultSummary & { skipped?: string[]; batch?: VkUrlBindBatchSummary };

      if (result.batch) {
        setLastBindBatch(result.batch);
      } else if (result.batchId) {
        setLastBindBatch({
          batchId: result.batchId,
          createdAt: new Date().toISOString(),
          accountId,
          mode: "need_vk_url",
          linksTotal: result.linksTotal,
          tasksUpdated: result.tasksUpdated,
          taskIds: result.updatedTaskIds ?? result.bound.map((item) => item.taskId),
        });
      }

      setBindResult({
        bound: result.tasksUpdated ?? result.bound.length,
        skipped: (result.notAssigned ?? result.skipped ?? []).length,
        errors: [
          ...(result.errors ?? []),
          ...(result.notRecognized ?? []).map(
            (item: { vkUrl: string; error: string }) => `${item.vkUrl}: ${item.error}`
          ),
        ],
        batchId: result.batchId,
        updatedTaskIds: result.updatedTaskIds ?? result.bound.map((item) => item.taskId),
      });
      setMessage(data.message || `Привязано: ${result.tasksUpdated ?? result.bound.length}`);
      await loadTasks();
      await loadBindBatches();
      await loadUnparsedUrls();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка привязки");
    } finally {
      setBinding(false);
    }
  }

  function renderBulkImport() {
    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-navy">Массовое обновление</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBulkImportMode("by_id")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                bulkImportMode === "by_id"
                  ? "bg-navy text-white"
                  : "border border-gray-border bg-white text-navy hover:bg-gray-card"
              }`}
            >
              По ID задачи
            </button>
            <button
              type="button"
              onClick={() => setBulkImportMode("auto_bind")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                bulkImportMode === "auto_bind"
                  ? "bg-emerald-600 text-white"
                  : "border border-gray-border bg-white text-navy hover:bg-gray-card"
              }`}
            >
              Автопривязка ссылок
            </button>
          </div>

          {bulkImportMode === "by_id" ? (
            <>
              <p className="mt-4 text-sm text-navy-muted">
                Формат строки:{" "}
                <code className="rounded bg-gray-card px-1.5 py-0.5">
                  id | vkUrl | assignedAccount | status
                </code>
              </p>
              <p className="mt-1 text-xs text-navy-muted">
                Старый формат:{" "}
                <code className="rounded bg-gray-card px-1.5 py-0.5">
                  id | vkUrl | vkGroupId | assignedAccount | status
                </code>
              </p>
              <p className="mt-1 text-xs text-navy-muted">
                Статусы: new, in_progress, need_vk_url, created, ready_for_worker, filled, posted, error
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-navy-muted">
                Каждая строка — только VK-ссылка. Ссылки назначаются свободным задачам аккаунта (
                <code>in_progress</code> / <code>created</code>, без vkUrl и vkGroupId).
              </p>
              <p className="mt-1 text-xs text-navy-muted">
                После привязки: vkGroupId распознаётся автоматически, status → ready_for_worker (если задан аккаунт).
              </p>
              <label className="mt-4 flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-navy-muted">Аккаунт *</span>
                <select
                  value={bulkAutoBindAccountId}
                  onChange={(e) => setBulkAutoBindAccountId(e.target.value)}
                  className="max-w-xs rounded-lg border border-gray-border bg-white px-3 py-2 text-sm"
                >
                  <option value="">— выберите аккаунт —</option>
                  {accountFilterOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              {bulkAutoBindAccountId ? (
                <p className="mt-1 text-xs text-navy-muted">
                  Свободных задач для привязки: {autoBindCandidatesForAccount.length}
                </p>
              ) : null}
            </>
          )}

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            placeholder={
              bulkImportMode === "auto_bind"
                ? `https://vk.com/club239728284\nhttps://vk.com/club239728299\nhttps://vk.com/club239728309`
                : `remont-televizorov-astrakhan | https://vk.com/club123 | 02 | created`
            }
            className="mt-4 w-full rounded-xl border border-gray-border px-4 py-3 font-mono text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBulkImport}
              disabled={bulkImporting || (bulkImportMode === "auto_bind" && !bulkAutoBindAccountId)}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                bulkImportMode === "auto_bind"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-navy hover:bg-navy-light"
              }`}
            >
              {bulkImporting
                ? bulkImportMode === "auto_bind"
                  ? "Привязка..."
                  : "Импорт..."
                : bulkImportMode === "auto_bind"
                  ? "Автопривязать"
                  : "Импортировать"}
            </button>
          </div>

          {bulkResult?.autoBind ? (
            <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm">
              <p className="font-medium text-navy">
                Ссылок вставлено: {bulkResult.autoBind.linksTotal} · Задач обновлено:{" "}
                {bulkResult.autoBind.tasksUpdated}
              </p>

              {bulkResult.autoBind.bound.length > 0 ? (
                <div>
                  <p className="font-medium text-navy">Назначения:</p>
                  <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-navy">
                    {bulkResult.autoBind.bound.map((item) => (
                      <li key={`${item.taskId}-${item.vkUrl}`}>
                        <span className="text-emerald-800">{item.taskId}</span>
                        {" ← "}
                        {item.vkUrl}
                        {item.vkGroupId ? (
                          <span className="text-navy-muted"> (vkGroupId: {item.vkGroupId})</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {bulkResult.autoBind.notRecognized.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="font-medium text-red-800">Не распознаны:</p>
                  <ul className="mt-1 list-inside list-disc text-red-700">
                    {bulkResult.autoBind.notRecognized.map((item) => (
                      <li key={item.vkUrl}>
                        {item.vkUrl} — {item.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {bulkResult.autoBind.notAssigned.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="font-medium text-amber-900">Не назначены (нет свободных задач):</p>
                  <ul className="mt-1 list-inside list-disc font-mono text-xs text-amber-800">
                    {bulkResult.autoBind.notAssigned.map((url) => (
                      <li key={url}>{url}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {bulkResult.autoBind.errors.length > 0 ? (
                <ul className="list-inside list-disc text-red-700">
                  {bulkResult.autoBind.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}

              {bulkResult.autoBind.batchId ? (
                renderBindBatchPanel({
                  batchId: bulkResult.autoBind.batchId,
                  tasksUpdated: bulkResult.autoBind.tasksUpdated,
                  taskIds:
                    bulkResult.autoBind.updatedTaskIds ??
                    bulkResult.autoBind.bound.map((item) => item.taskId),
                })
              ) : null}
            </div>
          ) : bulkResult ? (
            <div className="mt-4 rounded-lg border border-gray-border bg-gray-card px-4 py-3 text-sm">
              {bulkResult.updated > 0 ? (
                <p className="font-medium text-navy">Обновлено задач: {bulkResult.updated}</p>
              ) : null}
              {(bulkResult.unparsedAdded ?? 0) > 0 ? (
                <p className="font-medium text-navy">
                  Добавлено в «Неразобранные группы»: {bulkResult.unparsedAdded}
                </p>
              ) : null}
              {bulkResult.updated > 0 ? (
                bulkResult.notFound.length > 0 ? (
                  <p className="mt-2 text-red-700">
                    Не найдены id: {bulkResult.notFound.join(", ")}
                  </p>
                ) : (
                  <p className="mt-2 text-navy-muted">Все id найдены</p>
                )
              ) : null}
              {bulkResult.resolveWarnings && bulkResult.resolveWarnings.length > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="font-medium text-amber-900">Предупреждения распознавания vkGroupId:</p>
                  <ul className="mt-1 list-inside list-disc text-amber-800">
                    {bulkResult.resolveWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-navy">Неразобранные группы</h2>
              <p className="mt-1 text-sm text-navy-muted">
                Ссылки без привязки к задаче. Задач со статусом need_vk_url:{" "}
                <strong>{needVkUrlTasks.length}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={loadUnparsedUrls}
              disabled={unparsedLoading}
              className="rounded-lg border border-gray-border bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-card disabled:opacity-50"
            >
              {unparsedLoading ? "..." : "Обновить"}
            </button>
          </div>

          {unparsedUrls.length === 0 ? (
            <p className="mt-4 text-sm text-navy-muted">Очередь пуста</p>
          ) : (
            <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-navy">
              {unparsedUrls.map((item) => (
                <li key={item.id}>{item.vkUrl}</li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-navy-muted">Аккаунт для привязки</span>
              <select
                value={bindAccountId}
                onChange={(e) => setBindAccountId(e.target.value)}
                className="min-w-[180px] rounded-lg border border-gray-border bg-white px-3 py-2 text-sm"
              >
                <option value="">— выберите —</option>
                {accountFilterOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => handleBindUrls({ useUnparsedQueue: true, urls: [] })}
              disabled={binding || !bindAccountId || unparsedUrls.length === 0}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {binding ? "Привязка..." : "Привязать очередь к need_vk_url"}
            </button>
          </div>
          {bindAccountId ? (
            <p className="mt-2 text-xs text-navy-muted">
              Свободных задач need_vk_url для {bindAccountId}: {needVkUrlTasksForAccount.length}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-navy">Массовая привязка ссылок</h2>
          <p className="mt-1 text-sm text-navy-muted">
            Вставьте список VK-ссылок — система назначит их следующим свободным задачам{" "}
            <code>need_vk_url</code> выбранного аккаунта и распознает vkGroupId.
          </p>

          <textarea
            value={bindText}
            onChange={(e) => setBindText(e.target.value)}
            rows={5}
            placeholder={`https://vk.com/club123\nhttps://vk.com/club456\nhttps://vk.com/club789`}
            className="mt-4 w-full rounded-xl border border-gray-border bg-white px-4 py-3 font-mono text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-navy-muted">Аккаунт</span>
              <select
                value={bindAccountId}
                onChange={(e) => setBindAccountId(e.target.value)}
                className="min-w-[180px] rounded-lg border border-gray-border bg-white px-3 py-2 text-sm"
              >
                <option value="">— выберите —</option>
                {accountFilterOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => handleBindUrls()}
              disabled={binding || !bindAccountId}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {binding ? "Привязка..." : "Привязать ссылки"}
            </button>
          </div>

          {bindResult ? (
            <div className="mt-4 rounded-lg border border-gray-border bg-white px-4 py-3 text-sm">
              <p className="font-medium text-navy">Привязано: {bindResult.bound}</p>
              {bindResult.skipped > 0 ? (
                <p className="mt-1 text-amber-700">Пропущено (нет свободных задач): {bindResult.skipped}</p>
              ) : null}
              {bindResult.errors.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-red-700">
                  {bindResult.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {bindResult.batchId ? (
                renderBindBatchPanel({
                  batchId: bindResult.batchId,
                  tasksUpdated: bindResult.bound,
                  taskIds: bindResult.updatedTaskIds ?? [],
                })
              ) : null}
            </div>
          ) : null}
        </section>

        {needVkUrlTasks.length > 0 ? (
          <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-navy">
              Задачи need_vk_url ({needVkUrlTasks.length})
            </h2>
            <div className="mt-3 max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-border text-navy-muted">
                    <th className="py-2 pr-3">id</th>
                    <th className="py-2 pr-3">город</th>
                    <th className="py-2 pr-3">аккаунт</th>
                  </tr>
                </thead>
                <tbody>
                  {needVkUrlTasks.slice(0, 50).map((task) => (
                    <tr key={task.id} className="border-b border-gray-border/60">
                      <td className="py-2 pr-3 font-mono">{task.id}</td>
                      <td className="py-2 pr-3">{task.city}</td>
                      <td className="py-2 pr-3">{task.assignedAccount || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {needVkUrlTasks.length > 50 ? (
                <p className="mt-2 text-xs text-navy-muted">Показаны первые 50 из {needVkUrlTasks.length}</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  async function handleMarkCreated(task: VkTask) {
    const draft = getDraft(task);

    await saveTask(
      task.id,
      {
        vkUrl: draft.vkUrl.trim(),
        vkGroupId: draft.vkGroupId.trim(),
        assignedAccount: draft.assignedAccount.trim(),
      },
      {
        reload: true,
        markManualCreated: true,
        successMessage: "Группа отмечена — статус ready_for_worker или created",
      }
    );
  }

  async function handleManualGroupCreated(task: VkTask) {
    const draft = getDraft(task);

    if (!draft.vkGroupId.trim()) {
      setError("Заполните vkGroupId перед отметкой «Группа создана вручную»");
      return;
    }

    await saveTask(
      task.id,
      {
        vkUrl: draft.vkUrl.trim(),
        vkGroupId: draft.vkGroupId.trim(),
        assignedAccount: draft.assignedAccount.trim(),
      },
      {
        reload: true,
        markManualCreated: true,
        successMessage: "Группа отмечена как созданная вручную (ready_for_worker)",
      }
    );
  }

  async function handleResolveVkUrl(task: VkTask, options?: { auto?: boolean }) {
    const draft = getDraft(task);
    const vkUrl = draft.vkUrl.trim();

    if (!vkUrl) {
      if (!options?.auto) {
        setError("Укажите vkUrl для распознавания");
      }
      return;
    }

    const accountId = draft.assignedAccount.trim() || selectedAccountId;
    if (!accountId) {
      const message = "Выберите assignedAccount для распознавания screen_name";
      setResolveFeedback((prev) => ({ ...prev, [task.id]: { type: "error", message } }));
      if (!options?.auto) setError(message);
      return;
    }

    setResolvingId(task.id);
    if (!options?.auto) {
      setError(null);
      setMessage(null);
    }

    try {
      const res = await fetch("/api/vk-tasks/resolve-vk-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          vkUrl,
          accountId,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const message = data.error || data.resolve?.error || "Не удалось распознать VK URL";
        setResolveFeedback((prev) => ({ ...prev, [task.id]: { type: "error", message } }));
        if (!options?.auto) setError(message);
        return;
      }

      const updatedTask = data.task as VkTask;
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updatedTask : item)));
      setDrafts((prev) => ({ ...prev, [task.id]: taskToDraft(updatedTask) }));
      setResolveFeedback((prev) => ({
        ...prev,
        [task.id]: {
          type: "success",
          message: `vkGroupId: ${updatedTask.vkGroupId}`,
        },
      }));
      if (!options?.auto) {
        setMessage(data.message || `vkGroupId распознан: ${updatedTask.vkGroupId}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка распознавания VK URL";
      setResolveFeedback((prev) => ({ ...prev, [task.id]: { type: "error", message } }));
      if (!options?.auto) setError(message);
    } finally {
      setResolvingId(null);
    }
  }

  function renderResolveFeedback(taskId: string) {
    const feedback = resolveFeedback[taskId];
    if (!feedback) return null;

    return (
      <p
        className={`mt-1 text-xs ${
          feedback.type === "success" ? "text-emerald-700" : "text-red-700"
        }`}
      >
        {feedback.message}
      </p>
    );
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
          <div className="flex gap-2">
            <input
              type="url"
              value={draft.vkUrl}
              onChange={(e) => updateDraft(task.id, "vkUrl", e.target.value)}
              onBlur={() => {
                const nextDraft = getDraft(task);
                if (
                  nextDraft.vkUrl !== task.vkUrl ||
                  nextDraft.assignedAccount !== task.assignedAccount ||
                  nextDraft.vkGroupId !== task.vkGroupId
                ) {
                  saveTask(task.id, {
                    vkUrl: nextDraft.vkUrl.trim(),
                    assignedAccount: nextDraft.assignedAccount.trim(),
                    vkGroupId: nextDraft.vkGroupId.trim(),
                  });
                }
                if (nextDraft.vkUrl.trim() && nextDraft.vkUrl.trim() !== task.vkUrl) {
                  void handleResolveVkUrl(task, { auto: true });
                }
              }}
              placeholder="https://vk.com/..."
              className="min-w-0 flex-1 rounded-lg border border-gray-border px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
            />
            <ActionButton
              label={resolvingId === task.id ? "..." : "Распознать"}
              disabled={isSaving || resolvingId === task.id}
              onClick={() => handleResolveVkUrl(task)}
            />
          </div>
          {renderResolveFeedback(task.id)}
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
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-muted">VK Group ID</label>
          <input
            type="text"
            value={draft.vkGroupId}
            onChange={(e) => updateDraft(task.id, "vkGroupId", e.target.value)}
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
            placeholder="123456789"
            className="w-full rounded-lg border border-gray-border px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="Группа создана вручную"
            variant="primary"
            disabled={isSaving}
            onClick={() => handleManualGroupCreated(task)}
          />
          <ActionButton
            label="Создано"
            variant="success"
            disabled={isSaving}
            onClick={() => handleMarkCreated(task)}
          />
        </div>
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
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-navy-muted">VK URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={draft.vkUrl}
                  onChange={(e) => updateDraft(task.id, "vkUrl", e.target.value)}
                  onBlur={() => {
                    const nextDraft = getDraft(task);
                    if (nextDraft.vkUrl.trim() && nextDraft.vkUrl.trim() !== task.vkUrl) {
                      void handleResolveVkUrl(task, { auto: true });
                    }
                  }}
                  placeholder="https://vk.com/..."
                  className="min-w-0 flex-1 rounded-lg border border-gray-border px-3 py-2.5 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
                <ActionButton
                  label={resolvingId === task.id ? "..." : "Распознать"}
                  disabled={isSaving || resolvingId === task.id}
                  onClick={() => handleResolveVkUrl(task)}
                />
              </div>
              {renderResolveFeedback(task.id)}
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

        {renderManualSetupBlock(task)}

        {renderOperatorQualityChecklist(task)}

        <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
          <VkTaskImagesBlock
            task={task}
            variant="operator"
            onTaskUpdated={(updated) => {
              setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            }}
          />
        </section>

        <section className="rounded-xl border border-gray-border bg-gray-card p-4 sm:p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-muted">
            Статус задачи
          </h3>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              label="Группа создана вручную"
              variant="primary"
              className="px-4 py-2.5 text-sm"
              disabled={isSaving}
              onClick={() => handleManualGroupCreated(task)}
            />
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
        {lastBindBatch ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
            <p className="text-sm font-semibold text-teal-900">Последняя массовая привязка</p>
            {renderBindBatchPanel(lastBindBatch)}
          </div>
        ) : null}

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
              Новых: {stats.statuses.new ?? 0} · В работе: {stats.statuses.in_progress ?? 0} ·
              need_vk_url: {stats.statuses.need_vk_url ?? 0}
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
            <button
              type="button"
              onClick={() => setStatusFilter("vk_url_no_group_id")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                statusFilter === "vk_url_no_group_id"
                  ? "bg-orange text-white"
                  : "bg-white text-navy border border-gray-border"
              }`}
            >
              Есть vkUrl, но нет vkGroupId ({vkUrlNoGroupCount})
            </button>
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
            <span className="text-xs font-medium text-navy-muted">vkGroupId:</span>
            {(
              [
                { value: "all" as const, label: "Все" },
                { value: "yes" as const, label: "Есть" },
                { value: "no" as const, label: "Нет" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setHasVkGroupIdFilter(item.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  hasVkGroupIdFilter === item.value
                    ? "bg-teal-700 text-white"
                    : "bg-white text-navy border border-gray-border"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStrictReadyFilter(strictReadyFilter === "strict_ready" ? "all" : "strict_ready")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                strictReadyFilter === "strict_ready"
                  ? "bg-teal-700 text-white"
                  : "bg-white text-navy border border-gray-border"
              }`}
            >
              ready_for_worker_strict ({strictReadyCount})
            </button>
            <span className="text-xs font-medium text-navy-muted">lastBindBatchId:</span>
            <select
              value={bindBatchFilter}
              onChange={(e) => setBindBatchFilter(e.target.value)}
              className="rounded-lg border border-gray-border bg-white px-3 py-1.5 text-xs"
            >
              <option value="all">Все привязки</option>
              {bindBatchFilterOptions.map((batchId) => (
                <option key={batchId} value={batchId}>
                  {batchId}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-border bg-gray-card p-3">
            <span className="text-xs text-navy-muted">
              Выбрано: <strong className="text-navy">{selectedTaskIds.size}</strong>
            </span>
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              disabled={filtered.length === 0}
              className="rounded-lg border border-gray-border bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-card disabled:opacity-50"
            >
              {allFilteredSelected ? "Снять выбор с фильтра" : "Выбрать все на экране"}
            </button>
            <button
              type="button"
              onClick={handleGenerateQueueForSelected}
              disabled={queueForSelectedBusy || selectedTaskIds.size === 0}
              className="rounded-lg bg-orange px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-dark disabled:opacity-50"
            >
              {queueForSelectedBusy ? "..." : "Сформировать очередь только для выбранных"}
            </button>
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
                    <th className="px-3 py-3 font-medium">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        aria-label="Выбрать все задачи на экране"
                        className="h-4 w-4 rounded border-gray-border"
                      />
                    </th>
                    <th className="px-3 py-3 font-medium">Группа</th>
                    <th className="px-3 py-3 font-medium">Город</th>
                    <th className="px-3 py-3 font-medium">Услуга</th>
                    <th className="px-3 py-3 font-medium">Название VK</th>
                    <th className="px-3 py-3 font-medium">Телефон</th>
                    <th className="px-3 py-3 font-medium">Сайт</th>
                    <th className="px-3 py-3 font-medium">Статус</th>
                    <th className="px-3 py-3 font-medium">Качество</th>
                    <th className="px-3 py-3 font-medium">Картинки</th>
                    <th className="px-3 py-3 font-medium">Ручная настройка</th>
                    <th className="px-3 py-3 font-medium min-w-[220px]">VK / Аккаунт</th>
                    <th className="px-3 py-3 font-medium min-w-[280px]">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task) => (
                    <tr key={task.id} className="border-t border-gray-border align-top hover:bg-gray-card/50">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task.id)}
                          onChange={() => toggleTaskSelected(task.id)}
                          aria-label={`Выбрать ${task.id}`}
                          className="h-4 w-4 rounded border-gray-border"
                        />
                      </td>
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
                      <td className="px-3 py-3">{renderImageAssetsIndicators(task)}</td>
                      <td className="px-3 py-3">{renderManualSetupBlock(task, true)}</td>
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
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.has(task.id)}
                        onChange={() => toggleTaskSelected(task.id)}
                        aria-label={`Выбрать ${task.id}`}
                        className="mt-1 h-4 w-4 rounded border-gray-border"
                      />
                      <div>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${GROUP_BADGE[task.accountGroup]}`}>
                        {GROUP_LABELS[task.accountGroup]}
                      </span>
                      <h2 className="mt-2 text-base font-semibold text-navy">{task.vkName}</h2>
                      <p className="mt-0.5 font-mono text-xs text-navy-muted">{task.id}</p>
                    </div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>

                  <div className="mt-3">{renderQualityScore(task)}</div>
                  <div className="mt-3">{renderImageAssetsIndicators(task)}</div>
                  <div className="mt-3">{renderManualSetupBlock(task, true)}</div>

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

  if (loading && viewMode !== "accounts" && viewMode !== "log" && viewMode !== "dashboard" && viewMode !== "export" && viewMode !== "templates" && viewMode !== "visuals" && viewMode !== "images" && viewMode !== "groupprep" && viewMode !== "groupbinding" && viewMode !== "service" && viewMode !== "antiduplicates" && viewMode !== "assignment" && viewMode !== "automation" && viewMode !== "diagnostics") {
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
        {viewMode !== "accounts" && viewMode !== "log" && viewMode !== "dashboard" && viewMode !== "export" && viewMode !== "templates" && viewMode !== "visuals" && viewMode !== "images" && viewMode !== "groupprep" && viewMode !== "groupbinding" && viewMode !== "service" && viewMode !== "antiduplicates" && viewMode !== "assignment" && viewMode !== "automation" && viewMode !== "diagnostics" ? (
          <div className="text-sm text-navy-muted">
            В работе: <strong className="text-navy">{stats.statuses.in_progress ?? 0}</strong>
            {" · "}
            need_vk_url: <strong className="text-navy">{stats.statuses.need_vk_url ?? 0}</strong>
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
      ) : viewMode === "groupbinding" ? (
        <VkGroupBindingPanel tasks={tasks} accounts={accounts} onTasksUpdated={loadTasks} />
      ) : viewMode === "groupprep" ? (
        <VkGroupPrepPanel
          tasks={tasks}
          accounts={accounts}
          onTaskUpdated={(updated) => {
            setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          }}
          onOpenImagesTab={(taskId) => {
            setImagesFocusTaskId(taskId);
            setViewMode("images");
          }}
        />
      ) : viewMode === "service" ? (
        <VkServicePanel
          onResetComplete={async () => {
            await loadTasks();
            await loadAccounts();
            setLastBindBatch(null);
            setBindBatches([]);
          }}
        />
      ) : viewMode === "images" ? (
        <VkImagesPanel
          tasks={tasks}
          initialTaskId={imagesFocusTaskId}
          onTaskUpdated={(updated) => {
            setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          }}
          onTasksUpdated={(updatedTasks) => {
            setTasks((prev) => {
              const map = new Map(updatedTasks.map((item) => [item.id, item]));
              return prev.map((item) => map.get(item.id) ?? item);
            });
          }}
        />
      ) : viewMode === "antiduplicates" ? (
        <VkAntiDuplicatePanel
          tasks={tasks}
          onOpenTask={handleOpenTaskFromDuplicates}
          onTasksUpdated={loadTasks}
        />
      ) : viewMode === "assignment" ? (
        <VkBatchAssignPanel tasks={tasks} onAssigned={handleBatchAssigned} />
      ) : viewMode === "automation" ? (
        <VkAutomationPanel />
      ) : viewMode === "diagnostics" ? (
        <VkApiDiagnosticsPanel />
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
