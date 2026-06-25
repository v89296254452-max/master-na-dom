/** Бренды для блока «Работаем с техникой» (V2) */
export const DISPLAY_BRANDS = [
  { name: "LG", slug: "lg" },
  { name: "Samsung", slug: "samsung" },
  { name: "Bosch", slug: "bosch" },
  { name: "Electrolux", slug: "electrolux" },
  { name: "Haier", slug: "haier" },
  { name: "Indesit", slug: "indesit" },
  { name: "Candy", slug: "candy" },
  { name: "Atlant", slug: "atlant" },
  { name: "Ariston", slug: "ariston" },
  { name: "Hotpoint", slug: "hotpoint" },
  { name: "Beko", slug: "beko" },
  { name: "Midea", slug: "midea" },
  { name: "Liebherr", slug: "liebherr" },
] as const;

export interface BrandItem {
  name: string;
  slug: string;
}

const APPLIANCE_SLUGS = new Set([
  "remont-holodilnikov",
  "remont-stiralnyh-mashin",
  "remont-televizorov",
  "remont-kondicionerov",
  "remont-kofemashin",
  "remont-vodonagrevatelej",
  "remont-pmm",
  "remont-varochnyh-panelej",
  "remont-duhovyh-shkafov",
  "remont-parovyh-shkafov",
  "remont-vinnyh-shkafov",
  "remont-gladilnyh-sistem",
  "remont-massazhnyh-kresel",
]);

export function isApplianceService(serviceSlug: string): boolean {
  return APPLIANCE_SLUGS.has(serviceSlug) || serviceSlug.startsWith("remont-");
}

export function getServiceBrands(serviceSlug: string): BrandItem[] {
  if (!isApplianceService(serviceSlug)) return [];
  return [...DISPLAY_BRANDS];
}
