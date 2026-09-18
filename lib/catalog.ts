import { getAllPages, getServiceSlug, type Page } from "./pages";
import { slugify } from "./transliterate";
import { OFFER_CITIES, OFFER_SERVICE_NAMES } from "./offer-catalog";

/**
 * Каталог-агрегации над data/pages.csv для узлов-хабов (/uslugi, /goroda).
 * Даёт промежуточные узлы IA между главной и ~3000 гео-лендингов:
 *   /uslugi            → все услуги
 *   /uslugi/[service]  → одна услуга во всех городах
 *   /goroda            → все города
 *   /goroda/[city]     → все услуги в одном городе
 */

export interface ServiceGroup {
  serviceSlug: string;
  service: string;
  cityCount: number;
  samplePages: Page[];
}

export interface CityGroup {
  citySlug: string;
  city: string;
  cityPrepositional: string;
  serviceCount: number;
}

/** Слаг города из slug лендинга: slug = `${serviceSlug}-${citySlug}`. */
export function getCitySlug(page: Page): string {
  const serviceSlug = getServiceSlug(page);
  if (page.slug && serviceSlug && page.slug.startsWith(serviceSlug + "-")) {
    return page.slug.slice(serviceSlug.length + 1);
  }
  return page.city ? slugify(page.city) : "";
}

let servicesCache: ServiceGroup[] | null = null;
let citiesCache: CityGroup[] | null = null;

/** Все услуги, отсортированы по охвату городов (по убыванию). */
export function getAllServices(): ServiceGroup[] {
  if (servicesCache) return servicesCache;

  const map = new Map<string, { service: string; pages: Page[] }>();
  for (const page of getAllPages()) {
    if (!page.slug || !page.service) continue;
    const key = getServiceSlug(page);
    if (!key) continue;
    const entry = map.get(key);
    if (entry) {
      entry.pages.push(page);
    } else {
      map.set(key, { service: page.service, pages: [page] });
    }
  }

  servicesCache = [...map.entries()]
    .map(([serviceSlug, { service, pages }]) => ({
      serviceSlug,
      service,
      cityCount: pages.length,
      samplePages: pages.slice(0, 8),
    }))
    .sort((a, b) => b.cityCount - a.cityCount);

  return servicesCache;
}

/** Все города, отсортированы по числу услуг (по убыванию), затем по алфавиту. */
export function getAllCities(): CityGroup[] {
  if (citiesCache) return citiesCache;

  const map = new Map<
    string,
    { city: string; cityPrepositional: string; count: number }
  >();
  for (const page of getAllPages()) {
    if (!page.slug || !page.city) continue;
    const key = getCitySlug(page);
    if (!key) continue;
    const entry = map.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      map.set(key, {
        city: page.city,
        cityPrepositional: page.cityPrepositional || page.city,
        count: 1,
      });
    }
  }

  citiesCache = [...map.entries()]
    .map(([citySlug, { city, cityPrepositional, count }]) => ({
      citySlug,
      city,
      cityPrepositional,
      serviceCount: count,
    }))
    .sort((a, b) => b.serviceCount - a.serviceCount || a.city.localeCompare(b.city, "ru"));

  return citiesCache;
}

/**
 * Полный список названий услуг по алфавиту — для селектов лид-формы.
 * Раньше формы получали урезанные списки (8 услуг / 20 городов на главной,
 * одна услуга на гео-странице), из-за чего пользователь не мог выбрать
 * нужное направление.
 */
export function getServiceNames(): string[] {
  const fromCsv = getAllServices().map((s) => s.service);
  return [...new Set([...OFFER_SERVICE_NAMES, ...fromCsv])];
}

/** Полный список городов — каталог оффера + то, что есть в CSV. */
export function getCityNames(): string[] {
  const fromCsv = getAllCities().map((c) => c.city);
  return [...new Set([...OFFER_CITIES, ...fromCsv])];
}

/** Одна услуга: её название и все гео-лендинги (по городам, по алфавиту). */
export function getServiceGroup(
  serviceSlug: string
): { service: string; serviceSlug: string; pages: Page[] } | null {
  const pages = getAllPages().filter(
    (p) => p.slug && p.service && getServiceSlug(p) === serviceSlug
  );
  if (pages.length === 0) return null;
  pages.sort((a, b) => a.city.localeCompare(b.city, "ru"));
  return { service: pages[0].service, serviceSlug, pages };
}

/** Один город: его название и все услуги-лендинги в нём. */
export function getCityGroup(
  citySlug: string
): { city: string; cityPrepositional: string; citySlug: string; pages: Page[] } | null {
  const pages = getAllPages().filter((p) => p.slug && p.city && getCitySlug(p) === citySlug);
  if (pages.length === 0) return null;
  pages.sort((a, b) => a.service.localeCompare(b.service, "ru"));
  return {
    city: pages[0].city,
    cityPrepositional: pages[0].cityPrepositional || pages[0].city,
    citySlug,
    pages,
  };
}
