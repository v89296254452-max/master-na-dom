/**
 * Клиент Яндекс.Вебмастер API v4 — используется панелью /admin/seo для
 * мониторинга индексации и приоритетного переобхода без захода в интерфейс
 * Вебмастера. Креды: YANDEX_WM_TOKEN/USER/HOST в .env.local.
 */
function creds() {
  const token = process.env.YANDEX_WM_TOKEN;
  const user = process.env.YANDEX_WM_USER;
  const host = process.env.YANDEX_WM_HOST;
  if (!token || !user || !host) return null;
  return { token, user, host };
}

function api(host: string, user: string) {
  return `https://api.webmaster.yandex.net/v4/user/${user}/hosts/${host}`;
}

async function wmFetch(path: string) {
  const c = creds();
  if (!c) throw new Error("YANDEX_WM_TOKEN/USER/HOST не заданы в .env.local");
  const res = await fetch(`${api(c.host, c.user)}${path}`, {
    headers: { Authorization: `OAuth ${c.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Вебмастер API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export interface WmSummary {
  sqi: number;
  excluded_pages_count: number;
  searchable_pages_count: number;
  site_problems: Record<string, number>;
}
export interface WmProblem {
  key: string;
  severity: string;
  state: string;
  last_state_update: string | null;
}
export interface WmSample {
  url: string;
  last_access: string;
  title?: string;
}

export async function getSummary(): Promise<WmSummary> {
  return wmFetch("/summary");
}

/** Только реально активные проблемы (state=PRESENT) — остальное шум. */
export async function getActiveProblems(): Promise<WmProblem[]> {
  const data = await wmFetch("/diagnostics");
  const problems = (data.problems || {}) as Record<string, Omit<WmProblem, "key">>;
  return Object.entries(problems)
    .filter(([, p]) => p.state === "PRESENT")
    .map(([key, p]) => ({ key, ...p }));
}

export async function getInSearchSamples(limit = 10): Promise<{ count: number; samples: WmSample[] }> {
  return wmFetch(`/search-urls/in-search/samples?limit=${limit}`);
}

export interface WmHistoryPoint {
  date: string;
  value: number;
}

/** Динамика «страниц в поиске» по дням за N дней — для графика тренда. */
export async function getInSearchHistory(days = 30): Promise<WmHistoryPoint[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await wmFetch(`/search-urls/in-search/history?date_from=${fmt(from)}&date_to=${fmt(to)}`).catch(() => ({ history: [] }));
  const hist = (data.history || []) as { date: string; value: number }[];
  return hist.map((h) => ({ date: h.date.slice(0, 10), value: Math.round(h.value) }));
}

/** Динамика показов и кликов в выдаче по дням — виден реальный трафик. */
export async function getQueryHistory(days = 30): Promise<{ date: string; shows: number; clicks: number }[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await wmFetch(
    `/search-queries/all/history?date_from=${fmt(from)}&date_to=${fmt(to)}&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS`
  ).catch(() => ({ indicators: {} }));
  const ind = (data.indicators || {}) as Record<string, { date: string; value: number }[]>;
  const shows = new Map((ind.TOTAL_SHOWS || []).map((r) => [r.date.slice(0, 10), Math.round(r.value)]));
  const clicks = new Map((ind.TOTAL_CLICKS || []).map((r) => [r.date.slice(0, 10), Math.round(r.value)]));
  const dates = [...new Set([...shows.keys(), ...clicks.keys()])].sort();
  return dates.map((date) => ({ date, shows: shows.get(date) ?? 0, clicks: clicks.get(date) ?? 0 }));
}

export async function getRecrawlQuota(): Promise<number> {
  const q = await wmFetch("/recrawl/quota").catch(() => ({ quota_remainder: 0 }));
  return Math.max(0, Math.min(140, q.quota_remainder ?? 0));
}

export async function recrawlUrl(url: string): Promise<"ok" | "quota" | string> {
  const c = creds();
  if (!c) throw new Error("YANDEX_WM_TOKEN/USER/HOST не заданы в .env.local");
  try {
    const res = await fetch(`${api(c.host, c.user)}/recrawl/queue`, {
      method: "POST",
      headers: { Authorization: `OAuth ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.status === 202 || res.ok) return "ok";
    const t = await res.text();
    if (/quota/i.test(t)) return "quota";
    return `err ${res.status}`;
  } catch {
    return "fail";
  }
}
