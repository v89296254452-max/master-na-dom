"use client";

import { useEffect, useState } from "react";

interface CampaignRow {
  key: string;
  source: string;
  campaign: string;
  total: number;
  sent: number;
  approved: number;
  rejected: number;
  pending: number;
  commission: number;
  revenuePerApproved: number;
}
interface Resp {
  success: boolean;
  rows: CampaignRow[];
  error?: string;
}

export default function AdminCampaignsPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/campaigns", { cache: "no-store" });
        const data = (await res.json()) as Resp;
        if (!active) return;
        if (!data.success) throw new Error(data.error || "Ошибка");
        setRows(data.rows);
        setError("");
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Ошибка");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 30000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalLeads = rows.reduce((s, r) => s + r.total, 0);
  const totalApproved = rows.reduce((s, r) => s + r.approved, 0);

  return (
    <div className="max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-lg font-bold text-adm-ink-0">Кампании — окупаемость трафика</h1>
        <p className="mt-1 text-sm text-adm-ink-400">
          Заявки, выкуп и доход по источникам/кампаниям (метка <code className="rounded bg-adm-abyss-700 px-1.5 py-0.5 text-adm-ink-100">utm_source</code> /{" "}
          <code className="rounded bg-adm-abyss-700 px-1.5 py-0.5 text-adm-ink-100">utm_campaign</code> с заявки). Расход по кампании знаешь ты — дели доход на него,
          чтобы понять окупаемость Директа. Обновляется каждые 30 сек.
        </p>
      </div>

      {error && <div className="rounded-xl border border-adm-err/30 bg-adm-err/10 px-4 py-3 text-sm text-adm-err">{error}</div>}

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
            <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">Всего заявок</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-adm-ink-0">{totalLeads.toLocaleString("ru")}</div>
          </div>
          <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
            <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">Выкуплено</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-adm-ok">{totalApproved.toLocaleString("ru")}</div>
          </div>
          <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
            <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">Доход всего</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-adm-ok">{totalCommission.toLocaleString("ru")} ₽</div>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 shadow-sm">
        <div className="border-b border-adm-abyss-600 px-4 py-3 text-sm text-adm-ink-400">
          {loading ? "Загрузка..." : `${rows.length} источников/кампаний`}
        </div>
        <div className="overflow-x-auto admin-scrollbar">
          <table className="min-w-full divide-y divide-adm-abyss-600 text-sm">
            <thead className="bg-adm-abyss-700/60">
              <tr>
                {["Кампания", "Источник", "Заявки", "Отправлено", "Выкуплено", "Отказ", "Ожидание", "Доход", "Доход/выкуп"].map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-adm-abyss-600">
              {rows.map((r) => (
                <tr key={r.source + "|" + r.campaign} className="hover:bg-adm-abyss-700/40">
                  <td className="px-3 py-3 font-medium text-adm-ink-100">{r.campaign}</td>
                  <td className="px-3 py-3 text-adm-ink-400">{r.source}</td>
                  <td className="px-3 py-3 tabular-nums text-adm-ink-100">{r.total}</td>
                  <td className="px-3 py-3 tabular-nums text-adm-ink-400">{r.sent}</td>
                  <td className="px-3 py-3 tabular-nums text-adm-ok">{r.approved}</td>
                  <td className="px-3 py-3 tabular-nums text-adm-err">{r.rejected}</td>
                  <td className="px-3 py-3 tabular-nums text-adm-warn">{r.pending}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums font-semibold text-adm-ink-100">{r.commission.toLocaleString("ru")} ₽</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-adm-ink-400">{r.revenuePerApproved ? `${r.revenuePerApproved.toLocaleString("ru")} ₽` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-adm-ink-400">Заявок с метками пока нет — появятся при трафике с UTM</div>
        )}
      </section>
    </div>
  );
}
