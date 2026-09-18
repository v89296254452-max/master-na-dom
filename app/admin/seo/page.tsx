"use client";

import { useEffect, useState } from "react";

interface IndexNowResult {
  success: boolean;
  total?: number;
  submitted?: number;
  at?: string;
  error?: string;
}

interface WmSummary {
  sqi: number;
  excluded_pages_count: number;
  searchable_pages_count: number;
  site_problems: Record<string, number>;
}
interface WmProblem {
  key: string;
  severity: string;
  state: string;
  last_state_update: string | null;
}
interface WmSample {
  url: string;
  last_access: string;
  title?: string;
}
interface HistoryPoint {
  date: string;
  value: number;
}
interface QueryPoint {
  date: string;
  shows: number;
  clicks: number;
}
interface WmResp {
  success: boolean;
  summary?: WmSummary;
  problems?: WmProblem[];
  inSearch?: { count: number; samples: WmSample[] };
  quota?: number;
  history?: HistoryPoint[];
  queries?: QueryPoint[];
  error?: string;
}
interface RecrawlResp {
  success: boolean;
  log?: string;
  error?: string;
}

const LINKS = [
  { href: "/sitemap.xml", label: "sitemap.xml" },
  { href: "/feed.yml", label: "feed.yml (исполнители, YML)" },
  { href: "/feed.xml", label: "feed.xml (RSS, Свежее)" },
  { href: "/robots.txt", label: "robots.txt" },
];

const SEVERITY_STYLE: Record<string, string> = {
  FATAL: "bg-adm-err/15 text-adm-err border-adm-err/30",
  CRITICAL: "bg-adm-err/15 text-adm-err border-adm-err/30",
  POSSIBLE_PROBLEM: "bg-adm-warn/15 text-adm-warn border-adm-warn/30",
  RECOMMENDATION: "bg-adm-ink-400/15 text-adm-ink-400 border-adm-ink-400/30",
};

/** Простой столбчатый график по дням (inline SVG, без внешних либ). */
function BarChart({ points, color, title, format }: { points: { label: string; value: number }[]; color: string; title: string; format?: (n: number) => string }) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const W = Math.max(320, points.length * 26);
  const H = 120;
  const bw = W / points.length;
  const fmt = format || ((n: number) => n.toLocaleString("ru"));
  const last = points[points.length - 1];
  return (
    <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-adm-ink-400">{title}</span>
        <span className="text-xs text-adm-ink-400">макс {fmt(max)}</span>
      </div>
      <div className="overflow-x-auto admin-scrollbar">
        <svg width={W} height={H + 22} className="block">
          {points.map((p, i) => {
            const h = Math.round((p.value / max) * H);
            return (
              <g key={i}>
                <rect x={i * bw + 2} y={H - h} width={bw - 4} height={h} rx={2} fill={color} opacity={i === points.length - 1 ? 1 : 0.55}>
                  <title>{p.label}: {fmt(p.value)}</title>
                </rect>
                {i % 3 === 0 && <text x={i * bw + bw / 2} y={H + 15} textAnchor="middle" className="fill-adm-ink-400" fontSize="9">{p.label.slice(5)}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-1 text-xs text-adm-ink-400">Последний день: <b className="text-adm-ink-100">{fmt(last.value)}</b> ({last.label})</div>
    </div>
  );
}

export default function AdminSeoPage() {
  const [result, setResult] = useState<IndexNowResult | null>(null);
  const [busy, setBusy] = useState(false);

  const [wm, setWm] = useState<WmResp | null>(null);
  const [wmLoading, setWmLoading] = useState(true);
  const [recrawl, setRecrawl] = useState<RecrawlResp | null>(null);
  const [recrawlBusy, setRecrawlBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/webmaster", { cache: "no-store" });
        const data = (await res.json()) as WmResp;
        if (active) setWm(data);
      } catch (e) {
        if (active) setWm({ success: false, error: e instanceof Error ? e.message : "Ошибка" });
      } finally {
        if (active) setWmLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 60000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const trigger = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/indexnow", { method: "POST" });
      const data = (await res.json()) as IndexNowResult;
      setResult(data);
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "Ошибка" });
    } finally {
      setBusy(false);
    }
  };

  const triggerRecrawl = async () => {
    setRecrawlBusy(true);
    setRecrawl(null);
    try {
      const res = await fetch("/api/admin/webmaster", { method: "POST" });
      const data = (await res.json()) as RecrawlResp;
      setRecrawl(data);
    } catch (e) {
      setRecrawl({ success: false, error: e instanceof Error ? e.message : "Ошибка" });
    } finally {
      setRecrawlBusy(false);
    }
  };

  return (
    <div className="max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-lg font-bold text-adm-ink-0">SEO</h1>
        <p className="mt-1 text-sm text-adm-ink-400">Индексация в Яндексе, приоритетный переобход и технические файлы.</p>
      </div>

      {/* --- Яндекс.Вебмастер: мониторинг индексации --- */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">Индексация — Яндекс.Вебмастер</h2>

        {wmLoading && <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-5 text-sm text-adm-ink-400">Загрузка...</div>}

        {!wmLoading && wm && !wm.success && (
          <div className="rounded-2xl border border-adm-err/30 bg-adm-err/10 p-4 text-sm text-adm-err">{wm.error}</div>
        )}

        {!wmLoading && wm?.success && wm.summary && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
                <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">Индекс качества (sqi)</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-adm-ink-0">{wm.summary.sqi}</div>
              </div>
              <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
                <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">В поиске</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-adm-ok">{wm.summary.searchable_pages_count.toLocaleString("ru")}</div>
              </div>
              <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
                <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">Исключено</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-adm-warn">{wm.summary.excluded_pages_count.toLocaleString("ru")}</div>
              </div>
              <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
                <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">Квота переобхода</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-adm-ink-0">{wm.quota ?? "—"}</div>
              </div>
            </div>

            {wm.problems && wm.problems.length > 0 && (
              <div className="mt-3 rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-adm-ink-400">Активные проблемы</div>
                <div className="flex flex-wrap gap-2">
                  {wm.problems.map((p) => (
                    <span key={p.key} className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${SEVERITY_STYLE[p.severity] || SEVERITY_STYLE.RECOMMENDATION}`}>
                      {p.key}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {wm.problems && wm.problems.length === 0 && (
              <div className="mt-3 rounded-2xl border border-adm-ok/30 bg-adm-ok/10 p-4 text-sm text-adm-ok">✓ Активных проблем нет</div>
            )}

            {/* Динамика индексации и трафика по дням */}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {wm.history && wm.history.length > 0 && (
                <BarChart
                  title="Страниц в поиске (по дням)"
                  color="#34d399"
                  points={wm.history.map((h) => ({ label: h.date, value: h.value }))}
                />
              )}
              {wm.queries && wm.queries.length > 0 && (
                <BarChart
                  title="Клики из поиска (по дням)"
                  color="#60a5fa"
                  points={wm.queries.map((q) => ({ label: q.date, value: q.clicks }))}
                />
              )}
              {wm.queries && wm.queries.length > 0 && (
                <BarChart
                  title="Показы в выдаче (по дням)"
                  color="#a78bfa"
                  points={wm.queries.map((q) => ({ label: q.date, value: q.shows }))}
                />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
              <button
                type="button"
                onClick={() => void triggerRecrawl()}
                disabled={recrawlBusy}
                className="rounded-xl bg-gradient-to-r from-adm-brand-500 to-adm-purp px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-adm-brand-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recrawlBusy ? "Отправка..." : "Запустить приоритетный переобход"}
              </button>
              <span className="text-xs text-adm-ink-400">Свежий блог + топ-города × денежные услуги + ротация по всем гео. Работает и по крону ежедневно в 10:00.</span>
            </div>
            {recrawl?.success && <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-adm-abyss-900 p-3 text-xs text-adm-ok">{recrawl.log}</pre>}
            {recrawl && !recrawl.success && <p className="mt-2 text-sm text-adm-err">✗ {recrawl.error}</p>}

            {wm.inSearch && wm.inSearch.samples.length > 0 && (
              <div className="mt-3 rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-adm-ink-400">
                  Последние страницы, переобойдённые Яндексом (из {wm.inSearch.count.toLocaleString("ru")} в поиске)
                </div>
                <div className="space-y-1.5">
                  {wm.inSearch.samples.map((s) => (
                    <div key={s.url} className="flex items-center justify-between gap-3 text-xs">
                      <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-adm-brand-400 hover:underline">
                        {s.url.replace("https://master-na-dom.online/", "")}
                      </a>
                      <span className="shrink-0 tabular-nums text-adm-ink-400">{new Date(s.last_access).toLocaleString("ru")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- IndexNow --- */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">IndexNow (Яндекс/Bing)</h2>
        <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-5 shadow-sm">
          <p className="mb-3 text-sm text-adm-ink-400">
            Читает собственный sitemap.xml и отправляет все URL. Запускать после большого деплоя контента.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void trigger()}
              disabled={busy}
              className="rounded-xl bg-gradient-to-r from-adm-brand-500 to-adm-purp px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-adm-brand-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Отправка..." : "Отправить в IndexNow"}
            </button>
            {result?.success && (
              <span className="text-sm text-adm-ok">
                ✓ Отправлено {result.submitted?.toLocaleString("ru")} из {result.total?.toLocaleString("ru")} URL
              </span>
            )}
            {result && !result.success && <span className="text-sm text-adm-err">✗ {result.error}</span>}
          </div>
          {result?.at && <p className="mt-2 text-xs text-adm-ink-400">Последний запуск: {new Date(result.at).toLocaleString("ru")}</p>}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">Технические файлы</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-4 shadow-sm transition hover:border-adm-brand-500/40 hover:bg-adm-abyss-700/60"
            >
              <div className="size-9 rounded-lg bg-adm-brand-500/15 text-adm-brand-400 flex items-center justify-center">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </div>
              <span className="font-medium text-sm text-adm-ink-100">{l.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
