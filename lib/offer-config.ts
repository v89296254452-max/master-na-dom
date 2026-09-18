/**
 * Единая точка конфигурации попапа-оффера со скидкой (см. components/promaster/OfferPopup.tsx).
 * Меняешь тут — меняется везде (текст, аналитика, логика показа).
 */
export const DISCOUNT_PERCENT = 20;
export const OFFER_TIMEZONE = "Europe/Moscow";

/** Задержка до показа (мс) — одинаково на десктопе и мобильном (по запросу). */
export const SHOW_DELAY_MS = 15_000;

/** Не показывать повторно N дней после закрытия без отправки. */
export const CLOSED_COOLDOWN_DAYS = 7;
/** Не показывать повторно N дней после успешной отправки заявки. */
export const SUBMITTED_COOLDOWN_DAYS = 30;

export const STORAGE_KEYS = {
  lastShown: "master_offer_last_shown",
  closedUntil: "master_offer_closed_until",
  submittedUntil: "master_offer_submitted_until",
  /** sessionStorage: не показывать больше одного раза за вкладку/сессию. */
  shownSession: "master_offer_shown_session",
} as const;

export const YM_COUNTER_ID = 110026692;
