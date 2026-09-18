import { getCityFacts } from "../city-facts";
import { inCity } from "./ru";
import type { FaqItem } from "./faqs";

/**
 * Городская уникализация видимого контента: интро под H1 и 1–2 FAQ, собранные
 * из РЕАЛЬНЫХ фактов города (city-facts.json — районы/вода/климат/застройка).
 *
 * Раньше интро было одинаковым на всех городах (page.description из CSV), а FAQ
 * не содержал ничего локального. Ничего не выдумываем: если факта нет — блок
 * просто не добавляется, а интро падает на нейтральный (но живой) вариант.
 */

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** Интро под H1 — вариативное, с опорой на реальный факт города (если есть). */
export function buildCityIntro(service: string, city: string, cityPrep: string, seed: string): string {
  const f = getCityFacts(city);
  const svc = service.toLowerCase();
  const v = hash(seed) % 4;

  // Фактические зацепки — только известное. ВАЖНО: русские падежи. Названия
  // районов и услуг склонять нельзя (данные в именительном), поэтому все
  // формулировки построены так, чтобы подставлялся именительный, а город —
  // только в позиции после «в» (там cityPrep корректен).
  const hooks: string[] = [];
  if (f?.districts?.length) {
    hooks.push(`Выезжаем во все районы: ${f.districts.slice(0, 3).join(", ")} и другие`);
  }
  if (f?.housing) hooks.push(`Знаем местный жилфонд: ${f.housing.toLowerCase()}`);
  if (f?.water_hardness) hooks.push(`Учитываем местную воду — ${f.water_hardness.toLowerCase()}`);
  if (f?.climate_note) hooks.push(`Работаем с поправкой на климат — ${f.climate_note.toLowerCase()}`);

  const base = [
    `${service} на дом ${inCity(cityPrep)} — мастер приедет от 30 минут.`,
    `${service} ${inCity(cityPrep)} с выездом на дом: мастер будет у вас от 30 минут.`,
    `Нужен мастер ${inCity(cityPrep)}? ${service} с выездом на дом от 30 минут.`,
    `${service} на дому ${inCity(cityPrep)} — мастер выезжает от 30 минут.`,
  ][v];
  void svc;

  const hook = hooks.length ? ` ${hooks[hash(seed + "h") % hooks.length]}.` : "";
  return `${base}${hook} Диагностика бесплатно, оплата после работ.`;
}

/**
 * 1–2 FAQ, специфичных для города. Только по реальным фактам.
 * Ставятся ПЕРВЫМИ, чтобы попасть в видимые VISIBLE_FAQ_LIMIT (и, значит,
 * в FAQPage-разметку — она берёт тот же срез).
 */
export function buildCityFaqs(service: string, city: string, cityPrep: string): FaqItem[] {
  const f = getCityFacts(city);
  if (!f) return [];
  const out: FaqItem[] = [];
  const svc = service.toLowerCase();

  // Падежи: город подставляем только после «в» (cityPrep), названия районов —
  // в именительном, как в датасете. Иначе выходит «в какие районы Москве».
  if (f.districts?.length) {
    out.push({
      question: `В какие районы выезжает мастер ${inCity(cityPrep)}?`,
      answer: `Работаем во всех районах и пригороде: ${f.districts.slice(0, 6).join(", ")}. Наценки за отдалённость нет — мастер выезжает по всему городу, в среднем за 30 минут.`,
    });
  }

  if (f.water_hardness && /жёстк|жестк/i.test(f.water_hardness)) {
    out.push({
      question: `Влияет ли вода ${inCity(cityPrep)} на работу техники?`,
      answer: `Да. Вода ${inCity(cityPrep)} ${f.water_hardness.toLowerCase()}, поэтому накипь на нагревательных элементах — частая причина поломок. Мастер проверяет это при диагностике и подскажет, как продлить срок службы техники.`,
    });
  } else if (f.climate_note) {
    out.push({
      question: `Работаете ли ${inCity(cityPrep)} круглый год?`,
      answer: `Да, работаем круглосуточно и без выходных. Местный климат (${f.climate_note.toLowerCase()}) учитываем в работе — на выезд приезжаем в любую погоду.`,
    });
  }

  void svc;
  return out.slice(0, 2);
}
