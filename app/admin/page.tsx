"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ContentLayer {
  key: string;
  label: string;
  total: number;
  indexed: number;
}
interface StatsResponse {
  success: boolean;
  content: { layers: ContentLayer[]; totalPages: number; totalIndexed: number };
  leads: {
    total: number;
    today: number;
    last7d: number;
    approved: number;
    rejected: number;
    pending: number;
    totalCommission: number;
    partnerErrors: number;
  };
  error?: string;
}

const QUICK_LINKS = [
  { href: "https://ru.servicelead.top/", label: "Кабинет ServiceLead", icon: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" },
  { href: "https://search.google.com/search-console", label: "Google Search Console", icon: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" },
  { href: "https://webmaster.yandex.ru/", label: "Яндекс.Вебмастер", icon: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" },
];

export default function AdminOverviewPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        const json = (await res.json()) as StatsResponse;
        if (!active) return;
        if (!json.success) throw new Error(json.error || "Ошибка загрузки");
        setData(json);
        setError("");
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Ошибка");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 30000);
    return () => { active = false; clearInterval(t); };
  }, []);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-lg font-bold text-adm-ink-0">Обзор</h1>
        <p className="mt-1 text-sm text-adm-ink-400">Сводка по контенту и заявкам. Обновляется каждые 30 секунд.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-adm-err/30 bg-adm-err/10 px-4 py-3 text-sm text-adm-err">{error}</div>
      )}

      {loading && !data ? (
        <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-8 text-center text-adm-ink-400">
          Загрузка...
        </div>
      ) : data ? (
        <>
          {/* ALERTS */}
          {data.leads.partnerErrors > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/leads"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-adm-err/30 bg-adm-err/10 text-adm-err text-sm font-medium hover:scale-[1.02] transition"
              >
                <span>⚠️</span>
                <span>Заявки не отправлены в CRM:</span>
                <b className="tabular-nums">{data.leads.partnerErrors}</b>
              </Link>
            </div>
          )}

          {/* KPI GRID — заявки */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">Заявки</h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Всего" value={data.leads.total} />
              <KpiCard label="Сегодня" value={data.leads.today} color="info" />
              <KpiCard label="За 7 дней" value={data.leads.last7d} color="info" />
              <KpiCard label="Принято" value={data.leads.approved} color="ok" />
              <KpiCard label="Отклонено" value={data.leads.rejected} color="err" />
              <KpiCard label="В ожидании" value={data.leads.pending} color="warn" />
            </div>
            {data.leads.totalCommission > 0 && (
              <div className="mt-3 rounded-xl border border-adm-ok/30 bg-adm-ok/10 px-4 py-3 text-sm text-adm-ok">
                Комиссия по подтверждённым заявкам:{" "}
                <b className="tabular-nums">{data.leads.totalCommission.toLocaleString("ru")} ₽</b>
              </div>
            )}
            <Link href="/admin/leads" className="mt-3 inline-block text-sm font-medium text-adm-brand-400 hover:text-adm-brand-500">
              Все заявки →
            </Link>
          </section>

          {/* CONTENT */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">
              Контент сайта — {data.content.totalIndexed.toLocaleString("ru")} / {data.content.totalPages.toLocaleString("ru")} страниц с уникальным ИИ-текстом
            </h2>
            <div className="space-y-3">
              {data.content.layers.map((layer) => (
                <LayerBar key={layer.key} layer={layer} />
              ))}
            </div>
            <Link href="/admin/content" className="mt-4 inline-block text-sm font-medium text-adm-brand-400 hover:text-adm-brand-500">
              Подробнее по контенту →
            </Link>
          </section>

          {/* QUICK LINKS */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">Быстрые ссылки</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {QUICK_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4 shadow-sm transition hover:border-adm-brand-500/40 hover:bg-adm-abyss-700/60"
                >
                  <div className="size-9 rounded-lg bg-adm-brand-500/15 text-adm-brand-400 flex items-center justify-center">
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d={l.icon} />
                    </svg>
                  </div>
                  <span className="font-medium text-sm text-adm-ink-100">{l.label}</span>
                </a>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, color = "brand" }: { label: string; value: number; color?: "brand" | "ok" | "warn" | "err" | "info" }) {
  const colorMap: Record<string, string> = {
    brand: "text-adm-brand-400",
    ok: "text-adm-ok",
    warn: "text-adm-warn",
    err: "text-adm-err",
    info: "text-adm-info",
  };
  return (
    <div className="rounded-2xl bg-adm-abyss-800 border border-adm-abyss-600 p-4 shadow-sm hover:shadow-md hover:border-adm-abyss-500 transition">
      <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${colorMap[color]}`}>{value.toLocaleString("ru")}</div>
    </div>
  );
}

function LayerBar({ layer }: { layer: ContentLayer }) {
  const pct = layer.total > 0 ? Math.round((layer.indexed / layer.total) * 100) : 100;
  return (
    <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-adm-ink-100">{layer.label}</span>
        <span className="text-adm-ink-400 tabular-nums">
          {layer.indexed.toLocaleString("ru")} / {layer.total.toLocaleString("ru")} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-adm-abyss-600">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-adm-ok" : "bg-gradient-to-r from-adm-brand-500 to-adm-purp"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
