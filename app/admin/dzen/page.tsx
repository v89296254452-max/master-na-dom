"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DzenArticle, DzenArticleStatus } from "@/lib/dzen-types";
import { DZEN_ARTICLE_STATUSES } from "@/lib/dzen-types";

type StatusFilter = "" | DzenArticleStatus;

interface ArticlesResponse {
  success: boolean;
  total: number;
  items: DzenArticle[];
  error?: string;
}

interface PatchResponse {
  success: boolean;
  item?: DzenArticle;
  error?: string;
}

interface ArticleStats {
  total: number;
  draft: number;
  copied: number;
  published: number;
  error: number;
}

const STATUS_LABELS: Record<DzenArticleStatus, string> = {
  draft: "draft",
  copied: "copied",
  published: "published",
  error: "error",
};

const STATUS_BADGE: Record<DzenArticleStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  copied: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

function buildArticlesQuery(status: StatusFilter, service: string, city: string): string {
  const params = new URLSearchParams();

  if (status) {
    params.set("status", status);
  }
  if (service.trim()) {
    params.set("service", service.trim());
  }
  if (city.trim()) {
    params.set("city", city.trim());
  }

  const query = params.toString();
  return query ? `/api/dzen-articles?${query}` : "/api/dzen-articles";
}

function buildArticleCopyText(article: DzenArticle): string {
  return [
    `Заголовок:\n${article.title}`,
    `\nПодзаголовок:\n${article.subtitle}`,
    `\n${article.body}`,
    `\n${article.cta}`,
    `\nТелефон: ${article.phone}`,
    `\nТеги: ${article.tags.join(", ")}`,
    `\nИЗОБРАЖЕНИЯ:\n\n${article.imageUrls.join("\n")}`,
  ].join("\n");
}

function computeStats(items: DzenArticle[]): ArticleStats {
  return {
    total: items.length,
    draft: items.filter((item) => item.status === "draft").length,
    copied: items.filter((item) => item.status === "copied").length,
    published: items.filter((item) => item.status === "published").length,
    error: items.filter((item) => item.status === "error").length,
  };
}

function mergePublishedUrlDrafts(
  items: DzenArticle[],
  previous: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {};

  for (const item of items) {
    next[item.id] = previous[item.id] ?? item.publishedUrl ?? "";
  }

  return next;
}

async function fetchArticlesFromApi(url: string): Promise<DzenArticle[]> {
  const response = await fetch(url, { cache: "no-store" });

  let data: ArticlesResponse;
  try {
    data = (await response.json()) as ArticlesResponse;
  } catch {
    throw new Error("API вернул некорректный JSON");
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Не удалось загрузить статьи");
  }

  return Array.isArray(data.items) ? data.items : [];
}

export default function DzenAdminPage() {
  const [articles, setArticles] = useState<DzenArticle[]>([]);
  const [allArticles, setAllArticles] = useState<DzenArticle[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [publishedUrlDrafts, setPublishedUrlDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const previewArticle = useMemo(() => {
    if (!previewArticleId) {
      return null;
    }

    return (
      articles.find((item) => item.id === previewArticleId) ??
      allArticles.find((item) => item.id === previewArticleId) ??
      null
    );
  }, [allArticles, articles, previewArticleId]);

  const stats = useMemo(() => computeStats(allArticles), [allArticles]);

  const serviceOptions = useMemo(
    () => [...new Set(allArticles.map((item) => item.service))].sort((a, b) => a.localeCompare(b, "ru")),
    [allArticles]
  );

  const cityOptions = useMemo(
    () => [...new Set(allArticles.map((item) => item.city))].sort((a, b) => a.localeCompare(b, "ru")),
    [allArticles]
  );

  const setArticleBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const replaceArticle = useCallback((updated: DzenArticle) => {
    setArticles((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setAllArticles((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setPublishedUrlDrafts((current) => ({
      ...current,
      [updated.id]: updated.publishedUrl ?? "",
    }));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadArticles() {
      setLoading(true);
      setRefreshing(true);
      setError("");

      try {
        const [allItems, filteredItems] = await Promise.all([
          fetchArticlesFromApi("/api/dzen-articles"),
          fetchArticlesFromApi(buildArticlesQuery(statusFilter, serviceFilter, cityFilter)),
        ]);

        if (!active) {
          return;
        }

        setAllArticles(allItems);
        setArticles(filteredItems);
        setPublishedUrlDrafts((current) => mergePublishedUrlDrafts(filteredItems, current));
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Ошибка загрузки";
        setError(message);
        setAllArticles([]);
        setArticles([]);
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadArticles();

    return () => {
      active = false;
    };
  }, [cityFilter, reloadToken, serviceFilter, statusFilter]);

  const refreshData = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!previewArticleId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewArticleId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewArticleId]);

  const patchArticle = useCallback(
    async (id: string, patch: { status?: DzenArticleStatus; publishedUrl?: string | null }) => {
      setArticleBusy(id, true);
      setError("");
      setNotice("");

      try {
        const response = await fetch(`/api/dzen-articles/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await response.json()) as PatchResponse;

        if (!response.ok || !data.success || !data.item) {
          throw new Error(data.error ?? "Не удалось обновить статью");
        }

        replaceArticle(data.item);
        return data.item;
      } finally {
        setArticleBusy(id, false);
      }
    },
    [replaceArticle, setArticleBusy]
  );

  const handleCopyArticle = useCallback(
    async (article: DzenArticle) => {
      try {
        await navigator.clipboard.writeText(buildArticleCopyText(article));
        await patchArticle(article.id, { status: "copied" });
        setNotice(`Статья «${article.title}» скопирована, статус: copied`);
      } catch (copyError) {
        const message = copyError instanceof Error ? copyError.message : "Не удалось скопировать статью";
        setError(message);
      }
    },
    [patchArticle]
  );

  const handleSavePublishedUrl = useCallback(
    async (article: DzenArticle) => {
      const publishedUrl = (publishedUrlDrafts[article.id] ?? "").trim();

      if (!publishedUrl) {
        setError("Введите ссылку на опубликованную статью");
        return;
      }

      try {
        await patchArticle(article.id, { publishedUrl, status: "published" });
        setNotice(`Ссылка сохранена для «${article.title}»`);
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : "Не удалось сохранить ссылку";
        setError(message);
      }
    },
    [patchArticle, publishedUrlDrafts]
  );

  const handleSetStatus = useCallback(
    async (article: DzenArticle, status: DzenArticleStatus) => {
      try {
        await patchArticle(article.id, { status });
        setNotice(`Статус «${article.title}» изменён на ${status}`);
      } catch (statusError) {
        const message = statusError instanceof Error ? statusError.message : "Не удалось изменить статус";
        setError(message);
      }
    },
    [patchArticle]
  );

  const handleGenerateClick = () => {
    window.alert("Генерация пока через npm run generate:dzen");
  };

  return (
    <main className="min-h-screen bg-gray-light px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy sm:text-3xl">Яндекс Дзен — статьи</h1>
            <p className="mt-2 max-w-3xl text-sm text-navy-muted sm:text-base">
              Управление статьями для публикации в Дзене. Данные хранятся в{" "}
              <code className="rounded bg-white px-1.5 py-0.5">data/dzen-articles.json</code>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshData}
              disabled={refreshing}
              className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy transition hover:bg-gray-card disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Обновление..." : "Обновить список"}
            </button>
            <button
              type="button"
              onClick={handleGenerateClick}
              className="rounded-lg border border-gray-border bg-white px-4 py-2 text-sm font-medium text-navy transition hover:bg-gray-card"
            >
              Сгенерировать статьи
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Всего статей" value={stats.total} />
          <StatCard label="draft" value={stats.draft} badgeClass="bg-gray-100 text-gray-700" />
          <StatCard label="copied" value={stats.copied} badgeClass="bg-blue-100 text-blue-800" />
          <StatCard label="published" value={stats.published} badgeClass="bg-green-100 text-green-800" />
          <StatCard label="error" value={stats.error} badgeClass="bg-red-100 text-red-800" />
        </section>

        <section className="mb-6 rounded-xl border border-dashed border-gray-border bg-white p-4 text-sm text-navy">
          <h2 className="mb-2 font-semibold text-navy">API status (диагностика)</h2>
          <div className="grid gap-1 text-navy-muted sm:grid-cols-3">
            <p>
              loading: <span className="font-medium text-navy">{loading ? "true" : "false"}</span>
            </p>
            <p>
              error: <span className="font-medium text-navy">{error || "—"}</span>
            </p>
            <p>
              articles.length: <span className="font-medium text-navy">{articles.length}</span>
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-gray-border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-muted">Фильтры</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm text-navy">
              <span className="font-medium">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="rounded-lg border border-gray-border bg-white px-3 py-2 text-sm outline-none focus:border-navy-light"
              >
                <option value="">Все</option>
                {DZEN_ARTICLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-navy">
              <span className="font-medium">Service</span>
              <select
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
                className="rounded-lg border border-gray-border bg-white px-3 py-2 text-sm outline-none focus:border-navy-light"
              >
                <option value="">Все</option>
                {serviceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-navy">
              <span className="font-medium">City</span>
              <select
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                className="rounded-lg border border-gray-border bg-white px-3 py-2 text-sm outline-none focus:border-navy-light"
              >
                <option value="">Все</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {notice}
          </div>
        ) : null}

        {previewArticle ? (
          <ArticlePreviewModal
            article={previewArticle}
            busy={busyIds.has(previewArticle.id)}
            onClose={() => setPreviewArticleId(null)}
            onCopy={() => void handleCopyArticle(previewArticle)}
          />
        ) : null}

        <section className="overflow-hidden rounded-xl border border-gray-border bg-white shadow-sm">
          <div className="border-b border-gray-border px-4 py-3 text-sm text-navy-muted">
            {loading ? "Загрузка..." : `Показано статей: ${articles.length}`}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-border text-sm">
              <thead className="bg-gray-card">
                <tr>
                  {["status", "title", "Cover", "service", "city", "phone", "targetUrl", "publishedUrl", "actions"].map(
                    (column) => (
                      <th
                        key={column}
                        className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy-muted"
                      >
                        {column}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-border bg-white">
                {articles.map((article) => {
                  const busy = busyIds.has(article.id);

                  return (
                    <tr key={article.id} className="align-top hover:bg-gray-card/60">
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[article.status]}`}
                        >
                          {article.status}
                        </span>
                      </td>
                      <td className="max-w-xs px-3 py-3">
                        <div className="font-medium text-navy">{article.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-navy-muted">{article.subtitle}</div>
                      </td>
                      <td className="px-3 py-3">
                        {article.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={article.coverImage}
                            alt=""
                            className="h-16 w-24 rounded border border-gray-border object-cover"
                          />
                        ) : (
                          <span className="text-xs text-navy-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-navy">{article.service}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-navy">{article.city}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-navy">{article.phone}</td>
                      <td className="max-w-[220px] px-3 py-3">
                        <a
                          href={article.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-blue-700 hover:underline"
                        >
                          {article.targetUrl}
                        </a>
                      </td>
                      <td className="min-w-[260px] px-3 py-3">
                        <input
                          type="url"
                          value={publishedUrlDrafts[article.id] ?? ""}
                          onChange={(event) =>
                            setPublishedUrlDrafts((current) => ({
                              ...current,
                              [article.id]: event.target.value,
                            }))
                          }
                          placeholder="https://dzen.ru/a/..."
                          className="w-full rounded-lg border border-gray-border px-3 py-2 text-sm outline-none focus:border-navy-light"
                        />
                      </td>
                      <td className="min-w-[280px] px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <ActionButton
                            onClick={() => setPreviewArticleId(article.id)}
                            disabled={busy}
                            className="border border-gray-border bg-white text-navy hover:bg-gray-card"
                          >
                            Предпросмотр
                          </ActionButton>
                          <ActionButton
                            onClick={() => void handleCopyArticle(article)}
                            disabled={busy}
                            className="bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Скопировать статью
                          </ActionButton>
                          <ActionButton
                            onClick={() => void handleSavePublishedUrl(article)}
                            disabled={busy}
                            className="bg-green-600 text-white hover:bg-green-700"
                          >
                            Сохранить ссылку
                          </ActionButton>
                          <ActionButton
                            onClick={() => void handleSetStatus(article, "error")}
                            disabled={busy}
                            className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Ошибка
                          </ActionButton>
                          <ActionButton
                            onClick={() => void handleSetStatus(article, "draft")}
                            disabled={busy}
                            className="border border-gray-border bg-white text-navy hover:bg-gray-card"
                          >
                            Вернуть в draft
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && articles.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-navy-muted">Статьи не найдены</div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  badgeClass,
}: {
  label: string;
  value: number;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-border bg-white p-4 shadow-sm">
      <div className="text-sm text-navy-muted">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-2xl font-bold text-navy">{value}</span>
        {badgeClass ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>{label}</span>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function ArticlePreviewModal({
  article,
  busy,
  onClose,
  onCopy,
}: {
  article: DzenArticle;
  busy: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 px-4 py-6 sm:py-10"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-3xl rounded-xl border border-gray-border bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dzen-preview-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-muted">Предпросмотр статьи</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[article.status]}`}
              >
                {article.status}
              </span>
              <span className="text-xs text-navy-muted">
                {article.service} · {article.city}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-border px-3 py-1.5 text-sm text-navy hover:bg-gray-card"
          >
            Закрыть
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-5 py-5">
          <PreviewField label="Title">
            <h2 id="dzen-preview-title" className="text-xl font-bold text-navy">
              {article.title}
            </h2>
          </PreviewField>

          <PreviewField label="Subtitle">
            <p className="text-base text-navy-muted">{article.subtitle}</p>
          </PreviewField>

          <PreviewField label="Cover">
            {article.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.coverImage}
                alt=""
                className="max-h-64 w-full rounded-lg border border-gray-border object-cover"
              />
            ) : (
              <p className="text-sm text-navy-muted">—</p>
            )}
          </PreviewField>

          <PreviewField label="Body">
            <div className="whitespace-pre-wrap rounded-lg bg-gray-card px-4 py-3 text-sm leading-relaxed text-navy">
              {article.body}
            </div>
          </PreviewField>

          <PreviewField label="CTA">
            <p className="text-sm text-navy">{article.cta}</p>
          </PreviewField>

          <div className="grid gap-4 sm:grid-cols-2">
            <PreviewField label="Phone">
              <p className="text-sm text-navy">{article.phone}</p>
            </PreviewField>
            <PreviewField label="Tags">
              <p className="text-sm text-navy">{article.tags.join(", ") || "—"}</p>
            </PreviewField>
          </div>

          <PreviewField label="Image URLs">
            {article.imageUrls.length > 0 ? (
              <ul className="space-y-1 text-sm text-blue-700">
                {article.imageUrls.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className="break-all hover:underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-navy-muted">—</p>
            )}
          </PreviewField>

          <PreviewField label="Target URL">
            <a
              href={article.targetUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm text-blue-700 hover:underline"
            >
              {article.targetUrl}
            </a>
          </PreviewField>

          <PreviewField label="Published URL">
            {article.publishedUrl ? (
              <a
                href={article.publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm text-blue-700 hover:underline"
              >
                {article.publishedUrl}
              </a>
            ) : (
              <p className="text-sm text-navy-muted">—</p>
            )}
          </PreviewField>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-border px-5 py-4">
          <ActionButton
            onClick={onCopy}
            disabled={busy}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Скопировать статью
          </ActionButton>
          <ActionButton
            onClick={onClose}
            disabled={busy}
            className="border border-gray-border bg-white text-navy hover:bg-gray-card"
          >
            Закрыть
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-muted">{label}</div>
      {children}
    </div>
  );
}
