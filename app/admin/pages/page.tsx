"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface BrowsedPage {
  type: "geo" | "brand" | "problem";
  slug: string;
  title: string;
  service: string;
  city: string;
  extra: string;
  indexed: boolean;
  url: string;
}
interface PagesResponse {
  success: boolean;
  items: BrowsedPage[];
  total: number;
  error?: string;
}

const TYPE_LABEL: Record<string, string> = { geo: "Гео", brand: "Бренд", problem: "Проблема" };

export default function AdminPagesPage() {
  const [items, setItems] = useState<BrowsedPage[]>([]);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState<"" | "geo" | "brand" | "problem">("");
  const [q, setQ] = useState("");
  const [indexed, setIndexed] = useState<"" | "yes" | "no">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (q.trim()) p.set("q", q.trim());
    if (indexed) p.set("indexed", indexed);
    p.set("limit", "100");
    return p.toString();
  }, [type, q, indexed]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pages?${query}`, { cache: "no-store" });
      const data = (await res.json()) as PagesResponse;
      if (!data.success) throw new Error(data.error || "Ошибка");
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
    const t = setTimeout(() => void load(), 250); // дебаунс поиска
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-lg font-bold text-adm-ink-0">Страницы сайта</h1>
        <p className="mt-1 text-sm text-adm-ink-400">
          Поиск по всем гео/бренд/проблемным страницам — по городу, услуге, бренду или проблеме.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: город, услуга, бренд, проблема..."
          className="min-w-[260px] flex-1 rounded-xl border border-adm-abyss-600 bg-adm-abyss-800 px-3.5 py-2 text-sm text-adm-ink-100 outline-none placeholder:text-adm-ink-400 focus:border-adm-brand-500"
        />
        {(["", "geo", "brand", "problem"] as const).map((t) => (
          <button
            key={t || "all"}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              type === t ? "bg-adm-brand-500 text-white shadow-md shadow-adm-brand-500/30" : "border border-adm-abyss-600 bg-adm-abyss-800 text-adm-ink-300 hover:bg-adm-abyss-700"
            }`}
          >
            {t ? TYPE_LABEL[t] : "Все типы"}
          </button>
        ))}
        {(["", "yes", "no"] as const).map((v) => (
          <button
            key={v || "any"}
            type="button"
            onClick={() => setIndexed(v)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              indexed === v ? "bg-adm-brand-500 text-white shadow-md shadow-adm-brand-500/30" : "border border-adm-abyss-600 bg-adm-abyss-800 text-adm-ink-300 hover:bg-adm-abyss-700"
            }`}
          >
            {v === "" ? "Любой статус" : v === "yes" ? "В индексе" : "Без ИИ-текста"}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-adm-err/30 bg-adm-err/10 px-4 py-3 text-sm text-adm-err">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-adm-abyss-600 bg-adm-abyss-800 shadow-sm">
        <div className="border-b border-adm-abyss-600 px-4 py-3 text-sm text-adm-ink-400">
          {loading ? "Поиск..." : `Найдено ${total.toLocaleString("ru")}${total > items.length ? ` (показано первые ${items.length})` : ""}`}
        </div>
        <div className="overflow-x-auto admin-scrollbar">
          <table className="min-w-full divide-y divide-adm-abyss-600 text-sm">
            <thead className="bg-adm-abyss-700/60">
              <tr>
                {["Тип", "Заголовок", "Услуга", "Город", "Статус", ""].map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-adm-ink-400">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-adm-abyss-600">
              {items.map((p) => (
                <tr key={p.slug} className="hover:bg-adm-abyss-700/30">
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-md bg-adm-abyss-600 px-2 py-0.5 text-[11px] font-medium text-adm-ink-300">
                      {TYPE_LABEL[p.type]}
                    </span>
                  </td>
                  <td className="max-w-md px-3 py-3 text-adm-ink-100">{p.title}</td>
                  <td className="px-3 py-3 text-adm-ink-400">{p.service}</td>
                  <td className="px-3 py-3 text-adm-ink-400">{p.city}</td>
                  <td className="px-3 py-3">
                    {p.indexed ? (
                      <span className="text-adm-ok text-xs">✓ в индексе</span>
                    ) : (
                      <span className="text-adm-warn text-xs">⏳ ждёт ИИ</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-adm-brand-400 hover:text-adm-brand-500 text-xs font-medium"
                    >
                      Открыть ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-adm-ink-400">Ничего не найдено</div>
        )}
      </section>
    </div>
  );
}
