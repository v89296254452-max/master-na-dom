/**
 * Детерминированная генерация блока мастеров по slug — чтобы «команда» на
 * каждой странице отличалась (имена, рейтинги, опыт, число работ), а не была
 * одинаковой на всех 91k страниц (сигнал шаблонности для Яндекса).
 * Детерминизм важен: SSR и клиент должны совпасть (иначе гидрация ломается).
 */
export interface MasterCard {
  n: string;
  img: string;
  s: string;
  y: string;
  r: string;
  j: string;
}

const NAMES = [
  "Алексей", "Дмитрий", "Сергей", "Максим", "Андрей", "Игорь", "Николай", "Владимир",
  "Артём", "Роман", "Павел", "Виктор", "Евгений", "Олег", "Денис", "Константин",
  "Юрий", "Александр", "Михаил", "Иван", "Кирилл", "Антон", "Григорий", "Станислав",
];

// Специализации привязаны к фото master-1..4 (порядок фиксирован, меняем подписи ниже слегка).
const SPECS = ["Сантехник", "Электрик", "Ремонт техники", "Универсал", "Мастер на час", "Монтажник"];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 4 «мастера» под конкретный slug — стабильно и уникально по городу. */
export function getMasters(slug: string): MasterCard[] {
  const seed = hash(slug);
  const out: MasterCard[] = [];
  const usedNames = new Set<number>();
  for (let i = 0; i < 4; i++) {
    const s = (seed >> (i * 3)) ^ (seed * (i + 7));
    let ni = (s >>> 0) % NAMES.length;
    while (usedNames.has(ni)) ni = (ni + 1) % NAMES.length;
    usedNames.add(ni);
    const years = 5 + ((s >>> 4) % 12); // 5..16
    const rating = (47 + ((s >>> 8) % 4)) / 10; // 4.7..5.0
    const jobs = 160 + ((s >>> 2) % 520); // 160..680
    out.push({
      n: NAMES[ni],
      img: `master-${i + 1}`,
      s: SPECS[(s >>> 6) % SPECS.length],
      y: `${years} лет`,
      r: rating.toFixed(1),
      j: String(jobs),
    });
  }
  return out;
}

/** Стартовое число «мастеров онлайн» — 8..16, стабильно по slug. */
export function getOnlineCount(slug: string): number {
  return 8 + (hash(slug) % 9);
}
