"use client";

import { useEffect, useState } from "react";

interface ContentLayer {
  key: string;
  label: string;
  total: number;
  indexed: number;
}
interface StatsResponse {
  success: boolean;
  content: { layers: ContentLayer[]; totalPages: number; totalIndexed: number; generatedAt: string };
  error?: string;
}

export default function AdminContentPage() {
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
        if (!json.success) throw new Error(json.error || "Ошибка");
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
    const t = setInterval(load, 15000);
    return () => { active = false; clearInterval(t); };
  }, []);

  return (
    <div className="max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-lg font-bold text-adm-ink-0">Контент сайта</h1>
        <p className="mt-1 text-sm text-adm-ink-400">
          Индекс-гейт: страница появляется в sitemap и становится{" "}
          <code className="rounded bg-adm-abyss-700 px-1.5 py-0.5 text-adm-ink-100">index</code> только после того, как
          для неё сгенерирован уникальный ИИ-текст. Обновляется каждые 15 секунд.
        </p>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-5 shadow-sm">
              <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">Всего страниц на сайте</div>
              <div className="mt-2 text-3xl font-bold tabular-nums text-adm-ink-0">{data.content.totalPages.toLocaleString("ru")}</div>
            </div>
            <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-5 shadow-sm">
              <div className="text-[11px] uppercase tracking-wider text-adm-ink-400 font-semibold">С уникальным ИИ-текстом (в индексе)</div>
              <div className="mt-2 text-3xl font-bold tabular-nums text-adm-ok">
                {data.content.totalIndexed.toLocaleString("ru")}{" "}
                <span className="text-lg font-normal text-adm-ink-400">
                  ({Math.round((data.content.totalIndexed / data.content.totalPages) * 100)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 shadow-sm">
            <table className="min-w-full divide-y divide-adm-abyss-600 text-sm">
              <thead className="bg-adm-abyss-700/60">
                <tr>
                  {["Тип страниц", "Всего", "С ИИ-текстом", "Ожидают генерации", "Прогресс"].map((c) => (
                    <th key={c} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-adm-abyss-600">
                {data.content.layers.map((l) => {
                  const pct = l.total > 0 ? Math.round((l.indexed / l.total) * 100) : 100;
                  return (
                    <tr key={l.key} className="hover:bg-adm-abyss-700/30">
                      <td className="px-4 py-3 font-medium text-adm-ink-100">{l.label}</td>
                      <td className="px-4 py-3 tabular-nums text-adm-ink-100">{l.total.toLocaleString("ru")}</td>
                      <td className="px-4 py-3 tabular-nums text-adm-ok">{l.indexed.toLocaleString("ru")}</td>
                      <td className="px-4 py-3 tabular-nums text-adm-ink-400">{(l.total - l.indexed).toLocaleString("ru")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-adm-abyss-600">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? "bg-adm-ok" : "bg-gradient-to-r from-adm-brand-500 to-adm-purp"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-adm-ink-400">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-adm-ink-400">Обновлено: {new Date(data.content.generatedAt).toLocaleString("ru")}</p>
        </>
      ) : null}
    </div>
  );
}
