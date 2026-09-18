"use client";

import { useEffect, useState } from "react";

interface ServiceCoverage {
  serviceSlug: string;
  service: string;
  sitePages: number;
  offerCities: number;
  coveredPct: number;
  brandsCount: number;
  phoneLabel: string;
  phoneDisplay: string;
}
interface CoverageResponse {
  success: boolean;
  services: ServiceCoverage[];
  totalCities: number;
  error?: string;
}

const PHONE_BADGE: Record<string, string> = {
  КП: "bg-adm-info/15 text-adm-info",
  МнЧ: "bg-adm-purp/15 text-adm-purp",
  БТ: "bg-adm-ok/15 text-adm-ok",
};

export default function AdminCoveragePage() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/coverage", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: CoverageResponse) => {
        if (!active) return;
        if (!json.success) throw new Error(json.error || "Ошибка");
        setData(json);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-lg font-bold text-adm-ink-0">Покрытие по офферам</h1>
        <p className="mt-1 text-sm text-adm-ink-400">
          Данные из таблицы партнёра (ServiceLead): сколько городов реально обслуживает каждый оффер, против
          сколько гео-страниц сгенерено на сайте. Несовпадение = страницы для городов, где нет реального выезда
          (SEO-актив, но не обслуживаемые заявки).
        </p>
      </div>

      {error && <div className="rounded-xl border border-adm-err/30 bg-adm-err/10 px-4 py-3 text-sm text-adm-err">{error}</div>}

      {loading && !data ? (
        <div className="rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 p-8 text-center text-adm-ink-400">Загрузка...</div>
      ) : data ? (
        <div className="overflow-hidden rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 shadow-sm">
          <table className="min-w-full divide-y divide-adm-abyss-600 text-sm">
            <thead className="bg-adm-abyss-700/60">
              <tr>
                {["Услуга", "Номер", "Страниц на сайте", "Городов у оффера", "Покрытие", "Брендов"].map((c) => (
                  <th key={c} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-adm-abyss-600">
              {data.services.map((s) => (
                <tr key={s.serviceSlug} className="hover:bg-adm-abyss-700/30">
                  <td className="px-4 py-3 font-medium text-adm-ink-100">{s.service}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${PHONE_BADGE[s.phoneLabel] || "bg-adm-mute/15 text-adm-ink-300"}`}>
                      {s.phoneLabel}
                    </span>
                    <span className="ml-2 font-mono text-xs text-adm-ink-400">{s.phoneDisplay}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-adm-ink-100">{s.sitePages.toLocaleString("ru")}</td>
                  <td className="px-4 py-3 tabular-nums text-adm-ink-100">{s.offerCities.toLocaleString("ru")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-adm-abyss-600">
                        <div
                          className={`h-full rounded-full ${s.coveredPct >= 90 ? "bg-adm-ok" : s.coveredPct >= 50 ? "bg-adm-warn" : "bg-adm-err"}`}
                          style={{ width: `${Math.min(100, s.coveredPct)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-adm-ink-400">{s.coveredPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-adm-ink-100">{s.brandsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
