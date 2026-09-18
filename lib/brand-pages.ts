import { BRANDS_BY_SERVICE, getBrandsForService, type Brand } from "./brands";
import { getServiceSlug, getAllPages, type Page } from "./pages";
import { getCitySlug } from "./catalog";

/**
 * Страницы уровня бренда: «ремонт {техника} {бренд} в {городе}».
 * Слаг = `${serviceSlug}-${brandSlug}-${citySlug}` — резолвится на лету
 * (без отдельного CSV на десятки тысяч строк).
 */
export interface BrandPage {
  slug: string;
  serviceSlug: string;
  service: string;
  brand: string;
  brandSlug: string;
  city: string;
  cityDat: string;
  citySlug: string;
  phone: string;
  parent: Page; // родительская гео-страница услуга×город
}

// Раньше getBrandPageBySlug на каждый вызов (в т.ч. на каждый 404 — любой
// невалидный /[slug], который не нашёлся в pages.csv, проверялся и тут)
// делал вложенный перебор: все услуги × все бренды услуги + startsWith/slice.
// На проде это давало ~159мс на несуществующий slug против ~47-88мс на
// валидную cold-страницу — медленнее, чем должен быть путь к notFound().
// Строим Map один раз на процесс (как getPageBySlug в ./pages), дальше O(1).
let brandPageMap: Map<string, BrandPage> | null = null;

function buildBrandPageMap(): Map<string, BrandPage> {
  const map = new Map<string, BrandPage>();
  for (const page of getAllPages()) {
    if (!page.slug || !page.city) continue;
    const serviceSlug = getServiceSlug(page);
    if (!BRANDS_BY_SERVICE[serviceSlug]) continue;
    const citySlug = getCitySlug(page);
    for (const brand of getBrandsForService(serviceSlug)) {
      const slug = `${serviceSlug}-${brand.slug}-${citySlug}`;
      map.set(slug, {
        slug,
        serviceSlug,
        service: page.service || "Услуга",
        brand: brand.name,
        brandSlug: brand.slug,
        city: page.city || "",
        cityDat: page.cityPrepositional || page.city || "",
        citySlug,
        phone: page.phone || "",
        parent: page,
      });
    }
  }
  return map;
}

/** Разобрать слаг бренд-страницы в услугу+бренд+город. null если не подходит. */
export function getBrandPageBySlug(slug: string): BrandPage | null {
  if (!brandPageMap) brandPageMap = buildBrandPageMap();
  return brandPageMap.get(slug) ?? null;
}

/** Все слаги бренд-страниц (для sitemap/генерации). */
export function getAllBrandPageSlugs(): string[] {
  const out: string[] = [];
  const byService: Record<string, string[]> = {};
  for (const page of getAllPages()) {
    if (!page.slug || !page.city) continue;
    const s = getServiceSlug(page);
    if (!BRANDS_BY_SERVICE[s]) continue;
    (byService[s] = byService[s] || []).push(getCitySlug(page));
  }
  for (const [serviceSlug, citySlugs] of Object.entries(byService)) {
    for (const brand of getBrandsForService(serviceSlug)) {
      for (const citySlug of citySlugs) {
        out.push(`${serviceSlug}-${brand.slug}-${citySlug}`);
      }
    }
  }
  return out;
}

export type { Brand };
