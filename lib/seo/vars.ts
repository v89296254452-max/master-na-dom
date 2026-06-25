import type { Page } from "../pages";
import { getDistrictsList, getPhone, getServiceSlug } from "../pages";
import { BRAND } from "../service-templates";

export interface SeoVars {
  brand: string;
  service: string;
  serviceLower: string;
  serviceSlug: string;
  city: string;
  cityPrep: string;
  districts: string;
  phone: string;
  slug: string;
}

export function getSeoVars(page: Page): SeoVars {
  const service = page.service || "Услуга";
  const serviceSlug = getServiceSlug(page);

  return {
    brand: BRAND,
    service,
    serviceLower: service.toLowerCase(),
    serviceSlug,
    city: page.city || "",
    cityPrep: page.cityPrepositional || page.city || "городе",
    districts: getDistrictsList(page.districts).join(", "),
    phone: getPhone(page.phone),
    slug: page.slug || "",
  };
}

export function resolveText(
  template: string,
  vars: SeoVars,
  extra: Record<string, string> = {}
): string {
  const map: Record<string, string> = {
    brand: vars.brand,
    service: vars.service,
    serviceLower: vars.serviceLower,
    city: vars.city,
    cityPrep: vars.cityPrep,
    phone: vars.phone,
    ...extra,
  };

  return template.replace(/\{(\w+)\}/g, (_, key: string) => map[key] ?? `{${key}}`);
}
