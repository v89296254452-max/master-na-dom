"use client";

import { useCallback, useEffect, useState } from "react";
import type { VkAccount, VkAccountAuthStatus, VkAccountStatus, VkAccountWithStats } from "@/lib/vk-account-types";
import {
  DEFAULT_VK_ACCOUNT_AUTH,
  VK_ACCOUNT_AUTH_STATUS_LABELS,
  VK_ACCOUNT_STATUSES,
  VK_ACCOUNT_STATUS_LABELS,
} from "@/lib/vk-account-types";

type AccountDraft = Omit<VkAccount, "id"> & { id: string };

type AuthDraft = {
  accessToken: string;
  vkUserId: string;
};

const EMPTY_DRAFT: AccountDraft = {
  id: "",
  name: "",
  phone: "",
  status: "active",
  dailyLimit: 10,
  totalLimit: 50,
  notes: "",
  ...DEFAULT_VK_ACCOUNT_AUTH,
};

const STATUS_BADGE: Record<VkAccountStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  banned: "bg-red-100 text-red-800",
  problem: "bg-orange-100 text-orange-800",
};

const AUTH_BADGE: Record<VkAccountAuthStatus, string> = {
  not_connected: "bg-gray-100 text-gray-700",
  connected: "bg-emerald-100 text-emerald-800",
  expired: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
};

function accountToDraft(account: VkAccount): AccountDraft {
  return { ...account };
}

function authDraftFromAccount(account: VkAccount): AuthDraft {
  return {
    accessToken: account.accessToken,
    vkUserId: account.vkUserId,
  };
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
  });
}

export default function VkAccountsPanel() {
  const [accounts, setAccounts] = useState<VkAccountWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [authActionId, setAuthActionId] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<AccountDraft>({ ...EMPTY_DRAFT });
  const [drafts, setDrafts] = useState<Record<string, AccountDraft>>({});
  const [authDrafts, setAuthDrafts] = useState<Record<string, AuthDraft>>({});

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vk-accounts");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить аккаунты");
      }

      const nextAccounts = data.accounts as VkAccountWithStats[];
      setAccounts(nextAccounts);
      setDrafts(Object.fromEntries(nextAccounts.map((account) => [account.id, accountToDraft(account)])));
      setAuthDrafts(
        Object.fromEntries(nextAccounts.map((account) => [account.id, authDraftFromAccount(account)]))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  async function saveAccount(draft: AccountDraft) {
    if (!draft.id.trim()) {
      setError("id аккаунта обязателен");
      return;
    }

    setSavingId(draft.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось сохранить");
      }

      setMessage(`Аккаунт ${draft.id} сохранён`);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm(`Удалить аккаунт ${id}?`)) return;

    setSavingId(id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/vk-accounts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось удалить");
      }

      setMessage(`Аккаунт ${id} удалён`);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setSavingId(null);
    }
  }

  async function saveAuth(accountId: string) {
    const draft = authDrafts[accountId];
    if (!draft) return;

    setAuthActionId(accountId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-accounts/auth-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          accessToken: draft.accessToken,
          vkUserId: draft.vkUserId,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось сохранить токен");
      }

      setMessage(`Токен сохранён для ${accountId}`);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения токена");
    } finally {
      setAuthActionId(null);
    }
  }

  async function checkAuth(accountId: string) {
    setAuthActionId(accountId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-accounts/auth-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось проверить авторизацию");
      }

      setMessage(data.message || `Проверка выполнена для ${accountId}`);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка проверки");
    } finally {
      setAuthActionId(null);
    }
  }

  function updateDraft(id: string, field: keyof AccountDraft, value: string | number) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { ...EMPTY_DRAFT, id }),
        [field]: value,
      },
    }));
  }

  function updateAuthDraft(id: string, field: keyof AuthDraft, value: string) {
    setAuthDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { accessToken: "", vkUserId: "" }),
        [field]: value,
      },
    }));
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
        Загрузка аккаунтов...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || message) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Добавить аккаунт</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={newAccount.id}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, id: e.target.value }))}
            placeholder="id (acc-01)"
            className="rounded-lg border border-gray-border px-3 py-2 text-sm"
          />
          <input
            value={newAccount.name}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Название"
            className="rounded-lg border border-gray-border px-3 py-2 text-sm"
          />
          <input
            value={newAccount.phone}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Телефон"
            className="rounded-lg border border-gray-border px-3 py-2 text-sm"
          />
          <select
            value={newAccount.status}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, status: e.target.value as VkAccountStatus }))}
            className="rounded-lg border border-gray-border px-3 py-2 text-sm"
          >
            {VK_ACCOUNT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {VK_ACCOUNT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={newAccount.dailyLimit}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, dailyLimit: Number(e.target.value) }))}
            placeholder="Дневной лимит"
            className="rounded-lg border border-gray-border px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            value={newAccount.totalLimit}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, totalLimit: Number(e.target.value) }))}
            placeholder="Общий лимит"
            className="rounded-lg border border-gray-border px-3 py-2 text-sm"
          />
          <input
            value={newAccount.notes}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Заметки"
            className="rounded-lg border border-gray-border px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <button
          type="button"
          onClick={() => saveAccount(newAccount).then(() => setNewAccount({ ...EMPTY_DRAFT }))}
          disabled={savingId === newAccount.id}
          className="mt-4 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50"
        >
          Добавить аккаунт
        </button>
      </section>

      <div className="overflow-x-auto rounded-xl border border-gray-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-card text-navy-muted">
            <tr>
              <th className="px-3 py-3 font-medium">ID</th>
              <th className="px-3 py-3 font-medium">Название</th>
              <th className="px-3 py-3 font-medium">Статус</th>
              <th className="px-3 py-3 font-medium">Авторизация</th>
              <th className="px-3 py-3 font-medium">VK User ID</th>
              <th className="px-3 py-3 font-medium">Лимиты / назначено</th>
              <th className="px-3 py-3 font-medium">Авторизация VK</th>
              <th className="px-3 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-navy-muted">
                  Аккаунты не добавлены
                </td>
              </tr>
            ) : (
              accounts.map((account) => {
                const draft = drafts[account.id] ?? accountToDraft(account);
                const authDraft = authDrafts[account.id] ?? authDraftFromAccount(account);
                const isSaving = savingId === account.id;
                const isAuthBusy = authActionId === account.id;

                return (
                  <tr key={account.id} className="border-t border-gray-border align-top">
                    <td className="px-3 py-3 font-mono text-xs">{account.id}</td>
                    <td className="px-3 py-3">
                      <input
                        value={draft.name}
                        onChange={(e) => updateDraft(account.id, "name", e.target.value)}
                        className="w-full min-w-[120px] rounded border border-gray-border px-2 py-1"
                      />
                      <input
                        value={draft.phone}
                        onChange={(e) => updateDraft(account.id, "phone", e.target.value)}
                        placeholder="Телефон"
                        className="mt-1 w-full min-w-[120px] rounded border border-gray-border px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={draft.status}
                        onChange={(e) => updateDraft(account.id, "status", e.target.value)}
                        className="rounded border border-gray-border px-2 py-1"
                      >
                        {VK_ACCOUNT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {VK_ACCOUNT_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[account.status]}`}>
                          {VK_ACCOUNT_STATUS_LABELS[account.status]}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${AUTH_BADGE[account.authStatus]}`}
                      >
                        {VK_ACCOUNT_AUTH_STATUS_LABELS[account.authStatus]}
                      </span>
                      <div className="mt-1 text-xs text-navy-muted">
                        Проверка: {formatDateTime(account.lastAuthCheckAt)}
                      </div>
                      {account.lastAuthError ? (
                        <div className="mt-1 text-xs text-red-600">{account.lastAuthError}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{account.vkUserId || "—"}</td>
                    <td className="px-3 py-3 text-xs text-navy-muted">
                      <div>День: {account.limits.assignedToday} / {account.dailyLimit}</div>
                      <div>Всего: {account.limits.assignedTotal} / {account.totalLimit}</div>
                      <div className="mt-1 text-navy">Остаток: {Math.min(account.limits.dailyRemaining, account.limits.totalRemaining)}</div>
                      <div className="mt-1">Задач: {account.stats.total}</div>
                      <div className="mt-2 space-y-1">
                        <input
                          type="number"
                          min={0}
                          value={draft.dailyLimit}
                          onChange={(e) => updateDraft(account.id, "dailyLimit", Number(e.target.value))}
                          className="w-20 rounded border border-gray-border px-2 py-1"
                          title="Дневной лимит"
                        />
                        <input
                          type="number"
                          min={0}
                          value={draft.totalLimit}
                          onChange={(e) => updateDraft(account.id, "totalLimit", Number(e.target.value))}
                          className="w-20 rounded border border-gray-border px-2 py-1"
                          title="Общий лимит"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 min-w-[220px]">
                      <div className="space-y-2">
                        <label className="block text-xs text-navy-muted">accessToken</label>
                        <input
                          type="password"
                          value={authDraft.accessToken}
                          onChange={(e) => updateAuthDraft(account.id, "accessToken", e.target.value)}
                          placeholder="VK access token"
                          className="w-full rounded border border-gray-border px-2 py-1 text-xs font-mono"
                        />
                        <label className="block text-xs text-navy-muted">vkUserId</label>
                        <input
                          value={authDraft.vkUserId}
                          onChange={(e) => updateAuthDraft(account.id, "vkUserId", e.target.value)}
                          placeholder="123456789"
                          className="w-full rounded border border-gray-border px-2 py-1 text-xs font-mono"
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => saveAuth(account.id)}
                            disabled={isAuthBusy}
                            className="rounded bg-navy px-2 py-1 text-xs font-medium text-white hover:bg-navy-light disabled:opacity-50"
                          >
                            Сохранить токен
                          </button>
                          <button
                            type="button"
                            onClick={() => checkAuth(account.id)}
                            disabled={isAuthBusy}
                            className="rounded border border-gray-border bg-white px-2 py-1 text-xs font-medium text-navy hover:bg-gray-card disabled:opacity-50"
                          >
                            Проверить авторизацию
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={draft.notes}
                          onChange={(e) => updateDraft(account.id, "notes", e.target.value)}
                          rows={2}
                          placeholder="Заметки"
                          className="w-full min-w-[120px] rounded border border-gray-border px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => saveAccount(draft)}
                          disabled={isSaving}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAccount(account.id)}
                          disabled={isSaving}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
