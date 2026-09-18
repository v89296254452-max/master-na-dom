/**
 * Единый источник <title> и meta description для всех типов страниц.
 *
 * Принцип: сниппет несёт ВЫГОДУ и отличие, а не только «услуга+город».
 * Главный козырь, которого нет у конкурентов — «оплата после работ / без предоплаты».
 * Только реальные условия: выезд от 30 мин, диагностика бесплатно, оплата после
 * работ, гарантия до 12 мес, 24/7. Ничего не выдумываем.
 *
 * Длины: title ≤ 60, description 150–165. Обрезка — по словам, не рвём слова.
 */

import { inCity } from "./ru";

/** Акцент-символы (⭐/✓) в description. Флаг для A/B на CTR. По умолчанию ВЫКЛ. */
export const META_ACCENTS = false;

const TITLE_MAX = 60;
const DESC_MIN = 150;
const DESC_MAX = 165;

/** Детерминированный хеш — вариативность стабильна между сборками (без прыжков). */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** Обрезка по словам до max, без разрыва слов и висящей пунктуации. */
function truncateWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const i = cut.lastIndexOf(" ");
  return (i > 0 ? cut.slice(0, i) : cut).replace(/[\s,.;:—-]+$/, "");
}

/**
 * Title: первый кандидат, влезающий в ≤60.
 *
 * ВАЖНО: город — главный дифференциатор, его НЕЛЬЗЯ обрезать. Раньше длинные
 * названия обрезались по 60 и «съедали» город: «...варочных панелей в» — один
 * и тот же title для 279 городов. Поэтому кандидаты строятся так, чтобы
 * `${tail}` (город) всегда оставался, а укорачивалась левая часть.
 */
function pickTitle(candidates: string[], fallbackHead: string, tail: string): string {
  for (const c of candidates) {
    if (c.length <= TITLE_MAX) return c;
  }
  // резерв: режем левую часть, город сохраняем целиком
  const room = TITLE_MAX - tail.length;
  const head = truncateWords(fallbackHead, Math.max(8, room));
  return head + tail;
}

/**
 * Общий пул клауз-выгод, от длинных к коротким. Ассемблер жадно добирает те,
 * что влезают, пока не попадёт в 150–165 — короткие в конце гарантируют добор.
 * Все формулировки — реальные условия, ничего выдуманного.
 */
/** Клауза-выгода + ключи темы. Дедуп идёт по темам: «бесплатная диагностика» в
 *  голове и «Диагностика бесплатно» в хвосте — одна тема, второй раз не добавляем. */
export interface Clause {
  t: string;
  k: string[];
}

const TAIL_POOL: Clause[] = [
  { t: "Честная цена заранее, гарантия до 12 месяцев.", k: ["цен", "гарант"] },
  { t: "Цену фиксируем до начала работ.", k: ["цен"] },
  { t: "Диагностика бесплатно.", k: ["диагностик"] },
  { t: "Работаем круглосуточно.", k: ["круглосуточ", "24/7"] },
  { t: "Гарантия до 12 мес.", k: ["гарант"] },
  { t: "Звоните 24/7.", k: ["24/7", "круглосуточ"] },
  { t: "Без выходных.", k: ["выходн"] },
];

/**
 * Description: «голова» + клаузы-выгоды, пока не попадём в 150–165.
 * Сначала клаузы варианта, затем общий пул (добор короткими).
 * Клауза пропускается, если её тема уже озвучена — без повторов выгод.
 */
function assembleDesc(head: string, clauses: Clause[]): string {
  let s = head.length > DESC_MAX ? truncateWords(head, DESC_MAX) : head;
  for (const c of [...clauses, ...TAIL_POOL]) {
    if (s.length >= DESC_MIN) break;
    const low = s.toLowerCase();
    if (c.k.some((k) => low.includes(k))) continue; // тема уже есть
    const next = `${s} ${c.t}`;
    if (next.length <= DESC_MAX) s = next;
  }
  return s.length > DESC_MAX ? truncateWords(s, DESC_MAX) : s;
}

const ACC = () => (META_ACCENTS ? "✓ " : "");

// ---------- ГЕО: услуга + город ----------

export function buildGeoTitle(service: string, cityPrep: string): string {
  const tail = ` ${inCity(cityPrep)}`;
  const b = `${service}${tail}`;
  return pickTitle([
    `${b}: выезд 30 мин, оплата после работ`,
    `${b}: выезд 30 мин, без предоплаты`,
    `${b} — оплата после работ, 24/7`,
    `${b} — оплата после работ`,
    `${b} — выезд за 30 минут`,
    `${b} — выезд 30 мин`,
    b,
  ], service, tail);
}

export function buildGeoDescription(service: string, cityPrep: string, seed: string): string {
  // Головы без согласования по роду («Нужен {услуга}» ломается: помощь — ж.р.).
  const v = hash(seed) % 4;
  const heads = [
    `${service} ${inCity(cityPrep)} на дом: выезд от 30 мин, диагностика бесплатно, оплата после работ.`,
    `${service} ${inCity(cityPrep)}: мастер приедет за 30 минут, диагностика бесплатно, платите после работ.`,
    `${service} ${inCity(cityPrep)} без предоплаты — оплата только после выполненных работ. Выезд от 30 мин.`,
    `${service} ${inCity(cityPrep)} на дому: мастер за 30 минут, бесплатная диагностика, оплата по факту работ.`,
  ];
  const tails: Clause[][] = [
    [{ t: "Честная цена заранее, гарантия до 12 мес.", k: ["цен", "гарант"] }],
    [{ t: "Цену называем до начала работ.", k: ["цен"] }, { t: "Гарантия до 12 месяцев.", k: ["гарант"] }],
    [{ t: "Диагностика бесплатно, гарантия до 12 мес.", k: ["диагностик", "гарант"] }],
    [{ t: "Фиксируем цену до работ, гарантия до 12 мес.", k: ["цен", "гарант"] }],
  ];
  return assembleDesc(ACC() + heads[v], tails[v]);
}

// ---------- БРЕНД: услуга + бренд + город ----------

export function buildBrandTitle(service: string, brand: string, cityPrep: string): string {
  const tail = ` ${inCity(cityPrep)}`;
  const short = service.replace(/^Ремонт\s+/i, "");
  const full = `${service} ${brand}`;
  return pickTitle([
    `${full}${tail} — выезд 30 мин, гарантия`,
    `${full}${tail} — выезд 30 мин, оплата после`,
    `${full}${tail} — оплата после работ`,
    `${full}${tail} — выезд за 30 минут`,
    `${full}${tail} — выезд 30 мин`,
    `${full}${tail}`,
    `${short} ${brand}${tail}`,
  ], `${short} ${brand}`, tail);
}

export function buildBrandDescription(serviceShort: string, brand: string, cityPrep: string, seed: string): string {
  const v = hash(seed) % 3;
  // Услуга обязана быть в КАЖДОМ варианте: без неё «Samsung в Владивостоке»
  // совпадает у телевизоров и кондиционеров — дубли description.
  const heads = [
    `${serviceShort} ${brand} ${inCity(cityPrep)} на дому: выезд от 30 мин, диагностика бесплатно, оплата после работ.`,
    `${serviceShort} ${brand} ${inCity(cityPrep)}: мастер приедет за 30 минут, диагностика бесплатно, платите после ремонта.`,
    `${serviceShort} ${brand} ${inCity(cityPrep)} без предоплаты — оплата после работ. Выезд от 30 мин, диагностика бесплатно.`,
  ];
  const tails: Clause[][] = [
    [{ t: `Профильные запчасти ${brand}, гарантия до 12 мес.`, k: ["запчаст", "гарант"] }],
    [{ t: "Цену фиксируем заранее, гарантия до 12 мес.", k: ["цен", "гарант"] }],
    [{ t: `Знаем слабые места ${brand}, гарантия до 12 мес.`, k: ["слабые", "гарант"] }],
  ];
  return assembleDesc(ACC() + heads[v], tails[v]);
}

// ---------- PROBLEM-SERVICE: проблема + услуга + город ----------

export function buildProblemTitle(problem: string, serviceLow: string, cityPrep: string): string {
  const p = problem.charAt(0).toUpperCase() + problem.slice(1);
  const tail = ` ${inCity(cityPrep)}`;
  // Услуга И город обязательны в title: одна и та же проблема бывает у разных
  // услуг в одном городе («не подключается к Wi-Fi» — телевизор и компьютер).
  // Если выкинуть услугу, такие страницы получат одинаковый title.
  const svcTail = `: ${serviceLow}${tail}`;
  const cands = [
    `${p}${svcTail} — выезд за 30 мин`,
    `${p}${svcTail} — выезд 30 мин`,
    `${p}${svcTail}`,
  ];
  for (const c of cands) if (c.length <= TITLE_MAX) return c;
  const room = TITLE_MAX - svcTail.length;
  // хватает места на осмысленный кусок проблемы — режем её, услугу+город храним
  if (room >= 10) return truncateWords(p, room) + svcTail;
  // экстремально длинные услуга+город: сохраняем город, услугу сокращаем
  const svcShort = serviceLow.replace(/^ремонт\s+/i, "");
  const shortTail = `: ${svcShort}${tail}`;
  const room2 = TITLE_MAX - shortTail.length;
  if (room2 >= 10) return truncateWords(p, room2) + shortTail;
  return truncateWords(p, Math.max(8, TITLE_MAX - tail.length)) + tail;
}

export function buildProblemDescription(problem: string, serviceLow: string, cityPrep: string, seed: string): string {
  const v = hash(seed) % 3;
  const p = problem.toLowerCase();
  // Услуга обязана быть в КАЖДОМ варианте: одна проблема бывает у разных услуг
  // в одном городе («не подключается к Wi-Fi» — телевизор и компьютер).
  const P = p.charAt(0).toUpperCase() + p.slice(1);
  const heads = [
    `${P} — ${serviceLow} ${inCity(cityPrep)}: мастер приедет за 30 минут, диагностика бесплатно, оплата после работ.`,
    `Решаем «${p}»: ${serviceLow} ${inCity(cityPrep)}. Выезд от 30 мин, бесплатная диагностика, платите после ремонта.`,
    `${P}? Вызов мастера: ${serviceLow} ${inCity(cityPrep)} за 30 минут. Диагностика бесплатно, оплата после работ.`,
  ];
  const tails: Clause[][] = [
    [{ t: "Назовём причину и цену до ремонта.", k: ["причин", "цен"] }, { t: "Гарантия до 12 мес, работаем 24/7.", k: ["гарант", "24/7"] }],
    [{ t: "Причину назовём сразу, цена фиксируется.", k: ["причин", "цен"] }, { t: "Гарантия до 12 месяцев, 24/7.", k: ["гарант", "24/7"] }],
    [{ t: `Опытный мастер по направлению «${serviceLow}».`, k: ["направлен"] }, { t: "Гарантия до 12 мес, звоните 24/7.", k: ["гарант", "24/7"] }],
  ];
  return assembleDesc(ACC() + heads[v], tails[v]);
}

// ---------- ХАБЫ ----------

export function buildServiceHubTitle(service: string, citiesCount: number): string {
  const b = `${service} на дом`;
  return pickTitle([
    `${b} — ${citiesCount} городов, выезд 30 мин | ПроМастер`,
    `${b} — ${citiesCount} городов, выезд 30 мин`,
    `${b} — выезд 30 мин, оплата после работ`,
    `${b} — выезд за 30 минут`,
    b,
  ], service, " на дом");
}

export function buildServiceHubDescription(service: string, citiesCount: number): string {
  return assembleDesc(
    `${service} с выездом на дом в ${citiesCount} городах России: мастер за 30 минут, диагностика бесплатно, оплата после работ.`,
    [{ t: "Выберите город — покажем цены.", k: ["выберите"] }, { t: "Гарантия до 12 мес, 24/7.", k: ["гарант", "24/7"] }]
  );
}

export function buildCityHubTitle(cityPrep: string): string {
  const b = `Мастер на дом ${inCity(cityPrep)}`;
  return pickTitle([
    `${b} — сантехник, электрик, ремонт техники`,
    `${b} — сантехник, электрик, техника`,
    `${b} — выезд 30 мин, оплата после работ`,
    `${b} — выезд за 30 минут`,
    b,
  ], "Мастер на дом", ` ${inCity(cityPrep)}`);
}

export function buildCityHubDescription(cityPrep: string, services: string[]): string {
  const list = services.slice(0, 3).join(", ");
  return assembleDesc(
    `Вызов мастера на дом ${inCity(cityPrep)}: ${list} и другие услуги. Выезд от 30 мин, диагностика бесплатно, оплата после работ.`,
    [{ t: "Гарантия до 12 мес.", k: ["гарант"] }, { t: "Работаем 24/7.", k: ["24/7", "круглосуточ"] }]
  );
}
