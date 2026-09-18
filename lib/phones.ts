/**
 * Коллтрекинг по направлениям: разные подменные номера в зависимости от услуги.
 *   КП — компьютерная помощь
 *   БТ — бытовая техника (ремонт приборов)
 *   МнЧ — муж на час / общий (сантехник, электрик, окна, дезинфекция, клининг,
 *         сборка мебели, дефолт)
 */
export interface Phone { display: string; href: string; }

const NUM = {
  mnch: { display: "+7 (984) 333-32-49", href: "tel:+79843333249" },
  kp: { display: "+7 (986) 089-07-04", href: "tel:+79860890704" },
  bt: { display: "+7 (969) 999-24-97", href: "tel:+79699992497" },
} satisfies Record<string, Phone>;

/**
 * Бытовая техника — ремонт приборов → номер БТ (синие офферы в таблице).
 * ВАЖНО: телевизоры идут на номер КП (жёлтый оффер), а не БТ — по факту
 * настройки коллтрекинга (таблица офферов).
 */
const BT_SERVICES = new Set([
  "remont-holodilnikov", "remont-stiralnyh-mashin", "remont-pmm",
  "remont-kondicionerov", "remont-duhovyh-shkafov",
  "remont-varochnyh-panelej", "remont-vodonagrevatelej", "remont-kofemashin",
]);

/** Номер КП (жёлтые офферы): компьютерная помощь + телевизоры. */
const KP_SERVICES = new Set(["kp", "remont-televizorov"]);

/** Общий номер для главной/хабов/блога (без конкретного направления). */
export const DEFAULT_PHONE: Phone = NUM.mnch;

export function phoneForService(serviceSlug: string | undefined): Phone {
  if (!serviceSlug) return DEFAULT_PHONE;
  if (KP_SERVICES.has(serviceSlug)) return NUM.kp; // компьютерная помощь, телевизоры
  if (BT_SERVICES.has(serviceSlug)) return NUM.bt;
  return NUM.mnch; // santehnik, elektrik, master-na-chas, remont-okon, dezinfekciya, klining, sborka-mebeli…
}
