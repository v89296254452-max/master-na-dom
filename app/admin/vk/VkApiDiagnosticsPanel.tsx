"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VkAccountWithStats } from "@/lib/vk-account-types";
import { VK_ACCOUNT_AUTH_STATUS_LABELS } from "@/lib/vk-account-types";
import type {
  VkApiDiagnosticStepResult,
  VkApiDiagnosticsRunResult,
  VkExistingGroupTestResult,
  VkGroupsCreateTestResult,
  VkResolveUrlTestResult,
} from "@/lib/vk-api-diagnostics-types";

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StepCard({ step }: { step: VkApiDiagnosticStepResult }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <article
      className={`rounded-xl border bg-white ${
        step.success ? "border-emerald-200" : "border-red-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-navy">{step.label}</h3>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                step.success ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}
            >
              {step.success ? "OK" : "Ошибка"}
            </span>
            <span className="text-xs text-navy-muted">{formatDuration(step.durationMs)}</span>
          </div>
          {step.note ? <p className="mt-1 text-xs text-navy-muted">{step.note}</p> : null}
        </div>
        <span className="text-xs text-navy-muted">{expanded ? "Свернуть" : "Развернуть"}</span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-gray-border px-4 py-3">
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-muted">
              Запрос
            </h4>
            <pre className="overflow-x-auto rounded-lg bg-gray-card p-3 text-xs text-navy">
              {formatJson({
                method: step.request.method,
                url: step.request.url,
                params: step.request.params,
              })}
            </pre>
          </section>

          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-muted">
              Ответ (response)
            </h4>
            <pre className="overflow-x-auto rounded-lg bg-gray-card p-3 text-xs text-navy">
              {step.response === null ? "null" : formatJson(step.response)}
            </pre>
          </section>

          {step.rawBody !== undefined ? (
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-muted">
                Полный JSON ответ VK API
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-gray-card p-3 text-xs text-navy">
                {formatJson(step.rawBody)}
              </pre>
            </section>
          ) : null}

          {(step.vkError || step.httpError) && (
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                Ошибка VK
              </h4>
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {step.httpError ? <div>{step.httpError}</div> : null}
                {step.vkError ? (
                  <div>
                    {step.vkError.code !== undefined ? `[${step.vkError.code}] ` : ""}
                    {step.vkError.message}
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default function VkApiDiagnosticsPanel() {
  const [accounts, setAccounts] = useState<VkAccountWithStats[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [running, setRunning] = useState(false);
  const [testingCreate, setTestingCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VkApiDiagnosticsRunResult | null>(null);
  const [groupsCreateTest, setGroupsCreateTest] = useState<VkGroupsCreateTestResult | null>(null);
  const [existingGroupTest, setExistingGroupTest] = useState<VkExistingGroupTestResult | null>(null);
  const [existingGroupId, setExistingGroupId] = useState("");
  const [testingExistingGroup, setTestingExistingGroup] = useState(false);
  const [resolveVkUrlInput, setResolveVkUrlInput] = useState("");
  const [testingResolveVkUrl, setTestingResolveVkUrl] = useState(false);
  const [resolveUrlTest, setResolveUrlTest] = useState<VkResolveUrlTestResult | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setError(null);

    try {
      const res = await fetch("/api/vk-accounts");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить аккаунты");
      }

      const nextAccounts = data.accounts as VkAccountWithStats[];
      setAccounts(nextAccounts);

      setSelectedAccountId((current) => {
        if (current && nextAccounts.some((account) => account.id === current)) {
          return current;
        }

        const withToken = nextAccounts.find((account) => account.accessToken.trim());
        return withToken?.id ?? nextAccounts[0]?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки аккаунтов");
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const successCount = result?.steps.filter((step) => step.success).length ?? 0;
  const totalDuration = result?.steps.reduce((sum, step) => sum + step.durationMs, 0) ?? 0;

  async function handleRunDiagnostics() {
    if (!selectedAccountId) {
      setError("Выберите аккаунт");
      return;
    }

    if (!selectedAccount?.accessToken.trim()) {
      setError("У выбранного аккаунта нет accessToken");
      return;
    }

    if (
      !confirm(
        "Запустить диагностику VK API? groups.create создаст тестовую группу (и попытается удалить её после проверок)."
      )
    ) {
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);
    setGroupsCreateTest(null);
    setExistingGroupTest(null);
    setResolveUrlTest(null);

    try {
      const res = await fetch("/api/vk-api-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось выполнить диагностику");
      }

      setResult(data.result as VkApiDiagnosticsRunResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка диагностики");
    } finally {
      setRunning(false);
    }
  }

  async function handleTestGroupsCreate() {
    if (!selectedAccountId) {
      setError("Выберите аккаунт");
      return;
    }

    if (!selectedAccount?.accessToken.trim()) {
      setError("У выбранного аккаунта нет accessToken");
      return;
    }

    if (
      !confirm(
        'Создать тестовое сообщество «TEST MASTER LEADS» через groups.create? Будет показан полный JSON ответ VK.'
      )
    ) {
      return;
    }

    setTestingCreate(true);
    setError(null);
    setResult(null);
    setGroupsCreateTest(null);
    setExistingGroupTest(null);
    setResolveUrlTest(null);

    try {
      const res = await fetch("/api/vk-api-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          action: "test-groups-create",
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось выполнить тест groups.create");
      }

      setGroupsCreateTest(data.testResult as VkGroupsCreateTestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка теста groups.create");
    } finally {
      setTestingCreate(false);
    }
  }

  async function handleTestExistingGroup() {
    if (!selectedAccountId) {
      setError("Выберите аккаунт");
      return;
    }

    if (!selectedAccount?.accessToken.trim()) {
      setError("У выбранного аккаунта нет accessToken");
      return;
    }

    if (!existingGroupId.trim()) {
      setError("Укажите vkGroupId");
      return;
    }

    setTestingExistingGroup(true);
    setError(null);
    setResult(null);
    setGroupsCreateTest(null);
    setExistingGroupTest(null);
    setResolveUrlTest(null);

    try {
      const res = await fetch("/api/vk-api-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          action: "test-existing-group",
          vkGroupId: existingGroupId.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось проверить группу");
      }

      setExistingGroupTest(data.testResult as VkExistingGroupTestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка проверки группы");
    } finally {
      setTestingExistingGroup(false);
    }
  }

  async function handleTestResolveVkUrl() {
    if (!selectedAccountId) {
      setError("Выберите аккаунт");
      return;
    }

    if (!selectedAccount?.accessToken.trim()) {
      setError("У выбранного аккаунта нет accessToken");
      return;
    }

    if (!resolveVkUrlInput.trim()) {
      setError("Укажите vkUrl");
      return;
    }

    setTestingResolveVkUrl(true);
    setError(null);
    setResult(null);
    setGroupsCreateTest(null);
    setExistingGroupTest(null);
    setResolveUrlTest(null);

    try {
      const res = await fetch("/api/vk-api-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          action: "test-resolve-vk-url",
          vkUrl: resolveVkUrlInput.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось распознать VK ссылку");
      }

      setResolveUrlTest(data.testResult as VkResolveUrlTestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка распознавания VK ссылки");
    } finally {
      setTestingResolveVkUrl(false);
    }
  }

  if (loadingAccounts && accounts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
        Загрузка аккаунтов...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-navy">Диагностика VK API</h2>
            <p className="mt-1 text-sm text-navy-muted">
              Проверка доступности методов для accessToken выбранного аккаунта.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-navy-muted">
                Аккаунт
              </span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="min-w-[220px] rounded-lg border border-gray-border bg-white px-3 py-2 text-sm text-navy"
              >
                {accounts.length === 0 ? (
                  <option value="">Нет аккаунтов</option>
                ) : (
                  accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.id})
                    </option>
                  ))
                )}
              </select>
            </label>

            <button
              type="button"
              onClick={loadAccounts}
              disabled={loadingAccounts || running || testingCreate}
              className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-gray-card disabled:opacity-50"
            >
              {loadingAccounts ? "Обновление..." : "Обновить"}
            </button>

            <button
              type="button"
              onClick={handleTestGroupsCreate}
              disabled={testingCreate || running || testingExistingGroup || !selectedAccountId}
              className="rounded-lg border border-orange bg-orange/10 px-4 py-2 text-sm font-semibold text-orange hover:bg-orange/20 disabled:opacity-50"
            >
              {testingCreate ? "Тест..." : "Тест groups.create"}
            </button>

            <button
              type="button"
              onClick={handleRunDiagnostics}
              disabled={running || testingCreate || testingExistingGroup || !selectedAccountId}
              className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-dark disabled:opacity-50"
            >
              {running ? "Выполнение..." : "Запустить диагностику"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-gray-border bg-gray-card p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-navy-muted">
              vkGroupId для проверки
            </span>
            <input
              type="text"
              value={existingGroupId}
              onChange={(e) => setExistingGroupId(e.target.value)}
              placeholder="123456789"
              className="min-w-[180px] rounded-lg border border-gray-border bg-white px-3 py-2 text-sm text-navy"
            />
          </label>
            <button
              type="button"
              onClick={handleTestExistingGroup}
              disabled={testingExistingGroup || running || testingCreate || testingResolveVkUrl || !selectedAccountId}
              className="rounded-lg border border-navy bg-navy/5 px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/10 disabled:opacity-50"
            >
              {testingExistingGroup ? "Проверка..." : "Проверить существующую группу"}
            </button>
          </div>

        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-gray-border bg-gray-card p-3">
          <label className="block flex-1 min-w-[240px]">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-navy-muted">
              vkUrl для распознавания
            </span>
            <input
              type="text"
              value={resolveVkUrlInput}
              onChange={(e) => setResolveVkUrlInput(e.target.value)}
              placeholder="https://vk.com/club123456789 или remont_astana"
              className="w-full rounded-lg border border-gray-border bg-white px-3 py-2 text-sm text-navy"
            />
          </label>
          <button
            type="button"
            onClick={handleTestResolveVkUrl}
            disabled={testingResolveVkUrl || running || testingCreate || testingExistingGroup || !selectedAccountId}
            className="rounded-lg border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            {testingResolveVkUrl ? "Распознавание..." : "Распознать VK ссылку"}
          </button>
        </div>

        {selectedAccount ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-border bg-gray-card px-3 py-2 text-sm">
              <div className="text-xs text-navy-muted">Auth</div>
              <div className="font-medium text-navy">
                {VK_ACCOUNT_AUTH_STATUS_LABELS[selectedAccount.authStatus]}
              </div>
            </div>
            <div className="rounded-lg border border-gray-border bg-gray-card px-3 py-2 text-sm">
              <div className="text-xs text-navy-muted">VK User ID</div>
              <div className="font-mono text-navy">{selectedAccount.vkUserId || "—"}</div>
            </div>
            <div className="rounded-lg border border-gray-border bg-gray-card px-3 py-2 text-sm">
              <div className="text-xs text-navy-muted">Token</div>
              <div className="font-medium text-navy">
                {selectedAccount.accessToken.trim() ? "Задан" : "Не задан"}
              </div>
            </div>
            <div className="rounded-lg border border-gray-border bg-gray-card px-3 py-2 text-sm">
              <div className="text-xs text-navy-muted">Методы</div>
              <div className="text-xs text-navy">
                users.get · groups.get · groups.create · groups.edit · groups.editAddress · wall.post
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          groups.create выполняется в тестовом режиме: создаётся группа с префиксом{" "}
          <code>[DIAG-TEST]</code>, затем проверяются groups.edit (title/description/website),
          groups.editAddress и wall.post. После завершения
          система пытается удалить тестовую группу.
        </div>
      </section>

      {resolveUrlTest ? (
        <section className="space-y-3">
          <div className="rounded-xl border border-gray-border bg-white px-4 py-3">
            <div className="font-semibold text-navy">
              Распознавание VK ссылки: {resolveUrlTest.accountName} ({resolveUrlTest.accountId})
            </div>
            <div className="text-sm text-navy-muted">{formatDateTime(resolveUrlTest.ranAt)}</div>
          </div>
          <div className="rounded-xl border border-gray-border bg-white px-4 py-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-muted">vkUrl</dt>
                <dd className="mt-1 font-mono text-sm text-navy">{resolveUrlTest.resolve.vkUrl || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-muted">screenName</dt>
                <dd className="mt-1 font-mono text-sm text-navy">{resolveUrlTest.resolve.screenName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-muted">type</dt>
                <dd className="mt-1 font-mono text-sm text-navy">{resolveUrlTest.resolve.type}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-muted">vkGroupId</dt>
                <dd
                  className={`mt-1 font-mono text-sm ${
                    resolveUrlTest.resolve.vkGroupId ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {resolveUrlTest.resolve.vkGroupId || "—"}
                </dd>
              </div>
            </dl>
            {resolveUrlTest.resolve.error ? (
              <p className="mt-3 text-sm text-red-700">{resolveUrlTest.resolve.error}</p>
            ) : null}
            <div className="mt-4">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-muted">
                utils.resolveScreenName
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-gray-card p-3 text-xs text-navy">
                {formatJson(resolveUrlTest.resolve.resolveScreenNameResponse ?? null)}
              </pre>
            </div>
          </div>
        </section>
      ) : null}

      {existingGroupTest ? (
        <section className="space-y-3">
          <div className="rounded-xl border border-gray-border bg-white px-4 py-3">
            <div className="font-semibold text-navy">
              Проверка группы {existingGroupTest.vkGroupId}: {existingGroupTest.accountName}
            </div>
            <div className="text-sm text-navy-muted">{formatDateTime(existingGroupTest.ranAt)}</div>
          </div>
          {existingGroupTest.steps.map((step) => (
            <StepCard key={`${step.method}-${step.label}`} step={step} />
          ))}
        </section>
      ) : null}

      {groupsCreateTest ? (
        <section className="space-y-3">
          <div className="rounded-xl border border-gray-border bg-white px-4 py-3">
            <div className="font-semibold text-navy">
              Тест groups.create: {groupsCreateTest.accountName} ({groupsCreateTest.accountId})
            </div>
            <div className="text-sm text-navy-muted">{formatDateTime(groupsCreateTest.ranAt)}</div>
          </div>
          <StepCard step={groupsCreateTest.step} />
        </section>
      ) : null}

      {result ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-border bg-white px-4 py-3">
            <div>
              <div className="font-semibold text-navy">
                Результат: {result.accountName} ({result.accountId})
              </div>
              <div className="text-sm text-navy-muted">{formatDateTime(result.ranAt)}</div>
            </div>
            <div className="text-sm text-navy">
              Успешно: <strong>{successCount}</strong> / {result.steps.length}
              {" · "}
              Время: <strong>{formatDuration(totalDuration)}</strong>
            </div>
          </div>

          {result.steps.map((step) => (
            <StepCard key={step.method} step={step} />
          ))}
        </section>
      ) : !groupsCreateTest && !existingGroupTest && !resolveUrlTest ? (
        <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-10 text-center text-navy-muted">
          Выберите аккаунт и запустите тест или полную диагностику.
        </div>
      ) : null}
    </div>
  );
}
