import fs from "fs";
import path from "path";

/**
 * Выбор набора иллюстраций работ под конкретную страницу.
 *
 * Раньше все города одной услуги показывали ОДИН И ТОТ ЖЕ набор
 * `{service}-1..6` — идентичный блок на тысячах страниц (сигнал шаблонности).
 * Теперь из пула услуги (до 24 фото) детерминированно выбирается своя выборка
 * по хешу slug: наборы различаются между городами, но стабильны между сборками
 * (важно: без стабильности прыгал бы кэш и картинки «мигали» при ISR).
 */

const WORK_DIR = path.join(process.cwd(), "public", "images", "promaster", "work");

/** Размеры пулов по услугам, считаются один раз с диска. */
let pools: Map<string, number> | null = null;

function poolSize(serviceSlug: string): number {
  if (!pools) {
    pools = new Map();
    try {
      for (const f of fs.readdirSync(WORK_DIR)) {
        const m = f.match(/^(.+)-(\d+)\.jpg$/);
        if (!m) continue;
        const [, slug, n] = m;
        pools.set(slug, Math.max(pools.get(slug) ?? 0, parseInt(n, 10)));
      }
    } catch {
      /* каталога нет — пул пуст */
    }
  }
  return pools.get(serviceSlug) ?? 0;
}

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/**
 * `count` путей-иллюстраций (без расширения) для страницы.
 * Выбор — «окно» по пулу со сдвигом от slug + шаг, чтобы соседние города
 * не получали пересекающиеся подряд идущие наборы.
 */
export function getWorkPhotos(serviceSlug: string, slug: string, count = 6): string[] {
  const size = poolSize(serviceSlug);
  if (size === 0) return [];
  const take = Math.min(count, size);
  const h = hash(slug);
  const offset = h % size;
  // шаг взаимно простой с size (если возможно) — выборка «разбегается» по пулу
  const step = size > take ? 1 + ((h >>> 8) % Math.max(1, Math.floor(size / take))) : 1;
  const out: string[] = [];
  const used = new Set<number>();
  for (let i = 0; out.length < take && i < size * 2; i++) {
    const idx = ((offset + i * step) % size) + 1; // файлы нумеруются с 1
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(`/images/promaster/work/${serviceSlug}-${idx}`);
  }
  return out;
}

/** Есть ли вообще иллюстрации для услуги. */
export function hasWorkPhotos(serviceSlug: string): boolean {
  return poolSize(serviceSlug) > 0;
}
