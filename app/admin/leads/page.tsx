"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface LeadRecord {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  city: string;
  service: string;
  slug: string;
  source: string;
  offerId: number | null;
  cityId: number | null;
  partnerSent: boolean;
  partnerStatus: number | null;
  partnerError: string | null;
  partnerDuplicate: boolean;
  sheetsOk: boolean;
  status: string;
  orderId: string | null;
  leadIdPartner: string | null;
  commission: string | null;
  postbackAt: string | null;
}

interface LeadsResponse {
  success: boolean;
  items: LeadRecord[];
  total: number;
  error?: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: "Новая", pending: "Ожидание", approved: "Принята", rejected: "Отклонена",
};
const STATUS_COLOR: Record<string, string> = {
  new: "bg-adm-mute/15 text-adm-ink-300",
  pending: "bg-adm-warn/15 text-adm-warn",
  approved: "bg-adm-ok/15 text-adm-ok",
  rejected: "bg-adm-err/15 text-adm-err",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function AdminLeadsPage() {
  const [items, setItems] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    return params.toString();
  }, [statusFilter, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/leads?${query}`, { cache: "no-store" });
      const data = (await res.json()) as LeadsResponse;
      if (!data.success) throw new Error(data.error || "Ошибка загрузки");
      setItems(data.items);
      setTotal(data.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="max-w-[1400px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-adm-ink-0">Заявки</h1>
          <p className="mt-1 text-sm text-adm-ink-400">
            Заявки с сайта: статус отправки в партнёрскую CRM и результат постбэка. Обновляется каждые 20 сек.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-adm-abyss-600 bg-adm-abyss-800 px-4 py-2 text-sm font-medium text-adm-ink-100 hover:bg-adm-abyss-700"
        >
          Обновить
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {["", "new", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(0); }}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              statusFilter === s
                ? "bg-adm-brand-500 text-white shadow-md shadow-adm-brand-500/30"
                : "border border-adm-abyss-600 bg-adm-abyss-800 text-adm-ink-300 hover:bg-adm-abyss-700"
            }`}
          >
            {s ? STATUS_LABEL[s] : "Все"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-adm-err/30 bg-adm-err/10 px-4 py-3 text-sm text-adm-err">{error}</div>
      )}

      <section className="overflow-hidden rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 shadow-sm">
        <div className="border-b border-adm-abyss-600 px-4 py-3 text-sm text-adm-ink-400">
          {loading ? "Загрузка..." : `Показано ${items.length} из ${total}`}
        </div>
        <div className="overflow-x-auto admin-scrollbar">
          <table className="min-w-full divide-y divide-adm-abyss-600 text-sm">
            <thead className="bg-adm-abyss-700/60">
              <tr>
                {["Дата", "Статус", "Имя", "Телефон", "Услуга", "Город", "Источник", "Партнёр", "Комиссия"].map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-adm-abyss-600">
              {items.map((lead) => (
                <tr key={lead.id} className="hover:bg-adm-abyss-700/40">
                  <td className="whitespace-nowrap px-3 py-3 text-adm-ink-400">{formatDate(lead.createdAt)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-medium ${STATUS_COLOR[lead.status] || STATUS_COLOR.new}`}>
                      {STATUS_LABEL[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-adm-ink-100">{lead.name}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-adm-ink-100">{lead.phone}</td>
                  <td className="px-3 py-3 text-adm-ink-100">{lead.service}</td>
                  <td className="px-3 py-3 text-adm-ink-100">{lead.city}</td>
                  <td className="px-3 py-3 text-adm-ink-400">{lead.source}</td>
                  <td className="px-3 py-3">
                    {lead.partnerSent ? (
                      <span className="inline-flex items-center gap-1 text-adm-ok text-xs">
                        ✓ offer={lead.offerId ?? "-"}{lead.partnerDuplicate ? " (дубль)" : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-adm-err text-xs" title={lead.partnerError || ""}>
                        ✗ {lead.partnerError || "не отправлен"}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-adm-ink-100">
                    {lead.commission ? `${lead.commission} ₽` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-adm-ink-400">Заявок пока нет</div>
        )}
      </section>

      {total > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-xl border border-adm-abyss-600 bg-adm-abyss-800 px-3 py-1.5 text-sm text-adm-ink-100 disabled:opacity-40"
          >
            ← Назад
          </button>
          <span className="text-sm text-adm-ink-400">
            {page + 1} / {Math.ceil(total / pageSize)}
          </span>
          <button
            type="button"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-adm-abyss-600 bg-adm-abyss-800 px-3 py-1.5 text-sm text-adm-ink-100 disabled:opacity-40"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
