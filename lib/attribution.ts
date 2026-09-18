/**
 * Сквозная атрибуция платного трафика. Клиентский util: при заходе с меткой
 * (utm_*, yclid, gclid…) сохраняет её в cookie по модели first-touch (90 дней),
 * а формы прикладывают её к заявке. Так партнёрка получает clickid для
 * атрибуции/постбэка, а в нашей БД видно, какая кампания принесла заявку —
 * можно считать стоимость лида по кампаниям и оптимизировать Директ.
 */
const KEY = "pm_attr";
const PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "yclid", "gclid", "roistat", "_openstat", "erid",
];

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  yclid?: string;
  gclid?: string;
  referrer?: string;
  landing?: string;
  [k: string]: string | undefined;
}

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(name: string, value: string, days: number): void {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

/** Вызывать один раз при загрузке любой страницы (в SiteScripts). */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const found: Attribution = {};
    for (const p of PARAMS) {
      const v = url.searchParams.get(p);
      if (v) found[p] = v.slice(0, 200);
    }
    if (Object.keys(found).length === 0) return; // нет меток — не трогаем first-touch
    if (getCookie(KEY)) return; // first-touch: первую метку не перезаписываем
    found.referrer = (document.referrer || "").slice(0, 200);
    found.landing = url.pathname.slice(0, 200);
    setCookie(KEY, JSON.stringify(found), 90);
  } catch {
    /* приватный режим — молча */
  }
}

/** Прочитать сохранённую атрибуцию (для форм). */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const c = getCookie(KEY);
    return c ? (JSON.parse(c) as Attribution) : {};
  } catch {
    return {};
  }
}

/** Поля атрибуции для payload заявки (плоско, только заданные). */
export function attributionPayload(): Record<string, string> {
  const a = getAttribution();
  const out: Record<string, string> = {};
  if (a.utm_source) out.utmSource = a.utm_source;
  if (a.utm_medium) out.utmMedium = a.utm_medium;
  if (a.utm_campaign) out.utmCampaign = a.utm_campaign;
  if (a.utm_content) out.utmContent = a.utm_content;
  if (a.utm_term) out.utmTerm = a.utm_term;
  const clickid = a.yclid || a.gclid;
  if (clickid) out.clickid = clickid;
  if (a.referrer) out.referrer = a.referrer;
  return out;
}
