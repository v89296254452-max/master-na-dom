"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatRuPhone, isValidRuPhone } from "@/lib/phone-format";
import { attributionPayload } from "@/lib/attribution";
import { buildOfferTitle, buildOfferSubject, type OfferContext } from "@/lib/offer-copy";
import {
  DISCOUNT_PERCENT,
  SHOW_DELAY_MS,
  CLOSED_COOLDOWN_DAYS,
  SUBMITTED_COOLDOWN_DAYS,
  STORAGE_KEYS,
  YM_COUNTER_ID,
} from "@/lib/offer-config";

/**
 * Не переобъявляем global Window.ym здесь — он уже объявлен в CallForm.tsx/
 * HomeLeadForm.tsx с сигнатурой без 4-го аргумента (params); повторное
 * объявление с другой сигнатурой ловит TS2717 (conflicting declarations) и
 * валит сборку. Кастуем локально вместо расширения глобального типа.
 */
function track(event: string, params?: Record<string, unknown>) {
  const ym = (window as unknown as { ym?: (...args: unknown[]) => void }).ym;
  if (typeof ym === "function") {
    ym(YM_COUNTER_ID, "reachGoal", event, params);
  }
}

/**
 * Данные текущей SEO-страницы для оффера — читаются из скрытого элемента
 * #pm-offer-data, который эмиттят сами страницы (page.tsx, BrandPageView.tsx,
 * uslugi/[service], goroda/[city]) из УЖЕ ИМЕЮЩИХСЯ структурированных полей
 * (page.service/serviceSlug/city/cityPrepositional). Тот же паттерн, что и
 * #pm-page-phone для номера телефона (см. SiteScripts.tsx). Если элемента
 * нет на странице (главная, статика) — оффер показывается в generic-виде.
 */
function readPageOfferData(): OfferContext & { slug?: string } {
  if (typeof document === "undefined") return {};
  const el = document.getElementById("pm-offer-data") as HTMLElement | null;
  if (!el) return {};
  return {
    service: el.dataset.service || undefined,
    serviceSlug: el.dataset.serviceSlug || undefined,
    city: el.dataset.city || undefined,
    cityPrepositional: el.dataset.cityPrep || undefined,
    slug: el.dataset.slug || undefined,
  };
}

function readMs(key: string): number {
  try {
    return Number(localStorage.getItem(key) || 0) || 0;
  } catch {
    return 0;
  }
}
function writeMs(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* приватный режим — молча пропускаем */
  }
}

function genLeadId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ML-${y}${m}${d}-${rnd}`;
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

type Phase = "form" | "sending" | "success" | "error";

export default function OfferPopup() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [dateLabel, setDateLabel] = useState("");

  const ctxRef = useRef<OfferContext & { slug?: string }>({});
  const shownRef = useRef(false);
  const leadIdRef = useRef<string>("");
  const expiresAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Триггеры показа: таймер 15с (десктоп и мобильный — по требованию) ИЛИ
  // exit-intent на десктопе (курсор уходит за верхнюю границу viewport).
  // На тач-устройствах exit-intent технически не определить — не вешаем.
  useEffect(() => {
    ctxRef.current = readPageOfferData();

    const now = Date.now();
    if (readMs(STORAGE_KEYS.submittedUntil) > now) return;
    if (readMs(STORAGE_KEYS.closedUntil) > now) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEYS.shownSession)) return;
    } catch {
      /* ignore */
    }

    const show = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      void openPopup();
    };

    const timer = setTimeout(show, SHOW_DELAY_MS);

    let onMouseOut: ((e: MouseEvent) => void) | undefined;
    const isCoarsePointer = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (!isCoarsePointer) {
      onMouseOut = (e: MouseEvent) => {
        if (e.clientY <= 0) show();
      };
      document.addEventListener("mouseout", onMouseOut);
    }

    return () => {
      clearTimeout(timer);
      if (onMouseOut) document.removeEventListener("mouseout", onMouseOut);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC закрывает popup на десктопе
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("closed_esc");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function startCountdown(expiresAtMs: number) {
    expiresAtRef.current = expiresAtMs;
    if (tickRef.current) clearInterval(tickRef.current);
    const tick = () => {
      const left = expiresAtRef.current - Date.now();
      if (left <= 0) {
        // Сутки закончились, пока попап был открыт — подтягиваем новый
        // срок/дату, а не оставляем «дохлый» 00:00:00.
        void refreshOfferTime();
        return;
      }
      setRemainingMs(left);
    };
    tick();
    tickRef.current = setInterval(tick, 1000);
  }

  async function fetchOfferTime(): Promise<{ expiresAtMs: number; dateLabel: string }> {
    try {
      const res = await fetch("/api/offer-time", { cache: "no-store" });
      const data = (await res.json()) as { serverNow: string; offerExpiresAt: string };
      const serverNow = new Date(data.serverNow);
      const expiresAtMs = new Date(data.offerExpiresAt).getTime();
      const label = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Moscow",
      }).format(serverNow);
      return { expiresAtMs, dateLabel: label };
    } catch {
      // Фолбэк на локальные часы клиента, если /api/offer-time недоступен —
      // лучше показать таймер «примерно верно», чем сломать popup совсем.
      const now = new Date();
      const label = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Moscow",
      }).format(now);
      const mskShifted = new Date(now.getTime() + 3 * 3_600_000);
      const y = mskShifted.getUTCFullYear();
      const m = mskShifted.getUTCMonth();
      const d = mskShifted.getUTCDate();
      const nextMskMidnightUtc = Date.UTC(y, m, d + 1, 0, 0, 0, 0) - 3 * 3_600_000;
      return { expiresAtMs: nextMskMidnightUtc - 1, dateLabel: label };
    }
  }

  async function refreshOfferTime() {
    const { expiresAtMs, dateLabel: label } = await fetchOfferTime();
    setDateLabel(label);
    startCountdown(expiresAtMs);
  }

  async function openPopup() {
    setOpen(true);
    setPhase("form");
    leadIdRef.current = genLeadId();
    try {
      sessionStorage.setItem(STORAGE_KEYS.shownSession, "1");
    } catch {
      /* ignore */
    }
    writeMs(STORAGE_KEYS.lastShown, Date.now());
    const ctx = ctxRef.current;
    track("offer_shown", {
      service: ctx.serviceSlug || ctx.service,
      city: ctx.city,
      page: location.pathname,
      discount: DISCOUNT_PERCENT,
    });
    await refreshOfferTime();
  }

  function close(reason: "closed_button" | "closed_backdrop" | "closed_esc") {
    setOpen(false);
    if (tickRef.current) clearInterval(tickRef.current);
    writeMs(STORAGE_KEYS.closedUntil, Date.now() + CLOSED_COOLDOWN_DAYS * 86_400_000);
    const ctx = ctxRef.current;
    track("offer_closed", { service: ctx.serviceSlug || ctx.service, city: ctx.city, reason });
  }

  function handlePhoneFocus() {
    if (phase === "form" && !phone) {
      track("offer_form_start", { service: ctxRef.current.serviceSlug || ctxRef.current.service });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "sending") return; // защита от двойного сабмита
    if (!isValidRuPhone(phone)) {
      setPhoneError("Введите корректный номер телефона");
      return;
    }
    setPhoneError(null);
    setPhase("sending");

    const ctx = ctxRef.current;
    const attr = attributionPayload();
    track("offer_submit", { service: ctx.serviceSlug || ctx.service, city: ctx.city, discount: DISCOUNT_PERCENT });

    const noteParts = [
      `Заявка со скидкой ${DISCOUNT_PERCENT}% (popup-виджет).`,
      `ID: ${leadIdRef.current}.`,
      `Оффер действует до 23:59 (МСК) ${dateLabel || ""}.`.trim(),
    ];

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Заявка со скидкой",
          phone,
          problem: noteParts.join(" "),
          city: ctx.city || "",
          service: ctx.service || "",
          slug: ctx.slug || "",
          source: attr.utmSource || "offer_popup",
          ...attr,
        }),
      });
      const result = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !result.success) throw new Error("submit_failed");

      writeMs(STORAGE_KEYS.submittedUntil, Date.now() + SUBMITTED_COOLDOWN_DAYS * 86_400_000);
      if (tickRef.current) clearInterval(tickRef.current);
      setPhase("success");
      track("offer_success", { service: ctx.serviceSlug || ctx.service, city: ctx.city, discount: DISCOUNT_PERCENT });
      track("lead_submit");
    } catch {
      setPhase("error");
      track("offer_error", { service: ctx.serviceSlug || ctx.service, city: ctx.city });
    }
  }

  if (!open) return null;

  const ctx = ctxRef.current;
  const title = buildOfferTitle(ctx, DISCOUNT_PERCENT);
  const subject = buildOfferSubject(ctx);

  return (
    <div
      className="offer-pop-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close("closed_backdrop");
      }}
    >
      <div className="offer-pop" role="dialog" aria-modal="true" aria-label={title}>
        <button
          type="button"
          className="offer-pop__close"
          aria-label="Закрыть"
          onClick={() => close("closed_button")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {phase === "success" ? (
          <div className="offer-pop__body">
            <div className="offer-pop__icon">✅</div>
            <h3 className="offer-pop__title">Заявка принята</h3>
            <p className="offer-pop__lead">Скидка {DISCOUNT_PERCENT}% закреплена за вами.</p>
            <p className="offer-pop__muted">
              Мы передали заявку мастеру по услуге: <b>{subject}</b>
              {ctx.city ? (
                <>
                  <br />
                  Город: <b>{ctx.city}</b>
                </>
              ) : null}
            </p>
            <p className="offer-pop__muted">Мастер свяжется с вами по указанному номеру.</p>
          </div>
        ) : (
          <form className="offer-pop__body" onSubmit={handleSubmit}>
            <div className="offer-pop__icon">🎁</div>
            <h3 className="offer-pop__title">{title}</h3>
            <p className="offer-pop__sub">
              Только сегодня — до 23:59{dateLabel ? `, ${dateLabel}` : ""}
            </p>
            <div className="offer-pop__timer" aria-live="polite">
              <span className="offer-pop__timer-label">До окончания предложения:</span>
              <span className="offer-pop__timer-clock tnum">{fmtClock(remainingMs)}</span>
            </div>
            <p className="offer-pop__lead">
              Оставьте номер телефона — подберём специалиста под вашу задачу и закрепим скидку {DISCOUNT_PERCENT}%.
            </p>

            {phase === "error" && (
              <div className="offer-pop__error-banner">Не удалось отправить заявку. Попробуйте ещё раз.</div>
            )}

            <div className="field">
              <input
                type="tel"
                inputMode="tel"
                required
                disabled={phase === "sending"}
                value={phone}
                onFocus={handlePhoneFocus}
                onChange={(e) => {
                  setPhone(formatRuPhone(e.target.value));
                  if (phoneError) setPhoneError(null);
                }}
                placeholder="+7 (___) ___-__-__"
                aria-invalid={phoneError ? true : undefined}
                style={phoneError ? { borderColor: "#dc4444" } : undefined}
              />
              {phoneError && <p className="offer-pop__field-error">{phoneError}</p>}
            </div>

            <button type="submit" className="btn btn-accent offer-pop__submit" disabled={phase === "sending"}>
              {phase === "sending" ? "Отправляем…" : `Получить скидку ${DISCOUNT_PERCENT}%`}
            </button>

            <p className="offer-pop__fine">
              Без обязательств. Мастер свяжется с вами для уточнения деталей. Нажимая кнопку, вы соглашаетесь с{" "}
              <Link href="/politika-konfidencialnosti" target="_blank">
                политикой конфиденциальности
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
