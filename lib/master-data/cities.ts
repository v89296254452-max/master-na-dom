import { getAllPages } from "@/lib/pages";
import { listCities as listLegacyCities } from "@/lib/vk-automation/db";
import type { MasterCity } from "./types";
import { getMasterDataSource } from "./source";

export function getSeoCities(): MasterCity[] {
  const seen = new Map<string, MasterCity>();
  for (const page of getAllPages()) {
    if (!page.city) continue;
    const key = page.city.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, { name: page.city, slug: page.slug.split("-").slice(-1)[0] });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function getLegacyCities(): MasterCity[] {
  return listLegacyCities(5000).map((c) => ({
    name: c.name,
    region: c.region,
  }));
}

export function getMasterCities(source?: import("./types").MasterDataSource): MasterCity[] {
  const mode = source ?? getMasterDataSource();
  if (mode === "legacy") {
    const legacy = getLegacyCities();
    const seo = getSeoCities();
    const map = new Map<string, MasterCity>();
    for (const c of [...seo, ...legacy]) {
      map.set(c.name.toLowerCase(), c);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }
  return getSeoCities();
}
