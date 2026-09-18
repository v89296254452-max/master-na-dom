import fs from "fs";
import path from "path";

/**
 * Датасет реальных фактов по городам (data/city-facts.json, собран
 * scripts/build-city-facts.mjs через DeepSeek — только известные факты).
 * Используется для реальных районов и фактологически-уникального текста.
 */
export interface CityFacts {
  city: string;
  districts: string[];
  housing: string;
  water_hardness: string;
  climate_note: string;
  population_tier: string;
  price_coef: number;
  notable: string;
}

let cache: Record<string, CityFacts> | null = null;
let byName: Map<string, CityFacts> | null = null;

function load(): Record<string, CityFacts> {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "city-facts.json"), "utf8"));
  } catch {
    cache = {};
  }
  byName = new Map();
  for (const k in cache) {
    const f = cache[k];
    if (f?.city) byName.set(f.city.trim().toLowerCase(), f);
  }
  return cache!;
}

/** Факты по названию города (или citySlug-ключу). null, если нет. */
export function getCityFacts(cityName: string): CityFacts | null {
  load();
  return byName!.get((cityName || "").trim().toLowerCase()) || null;
}
