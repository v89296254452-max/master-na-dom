import { getAllPages, getPageBySlug } from "@/lib/pages";
import { getAccountGroup, getPageSiteUrl } from "@/lib/vk-generator";
import type { MasterLandingPage } from "./types";

export function getLandingPages(): MasterLandingPage[] {
  return getAllPages()
    .filter((page) => page.slug && page.city && page.service)
    .map((page) => ({
      slug: page.slug,
      city: page.city,
      cityPrepositional: page.cityPrepositional,
      service: page.service,
      serviceSlug: page.serviceSlug,
      phone: page.phone,
      url: getPageSiteUrl(page),
      offerGroup: getAccountGroup(page),
      title: page.title,
      description: page.description,
    }));
}

export function getLandingPageBySlug(slug: string): MasterLandingPage | null {
  const page = getPageBySlug(slug);
  if (!page) return null;
  return {
    slug: page.slug,
    city: page.city,
    cityPrepositional: page.cityPrepositional,
    service: page.service,
    serviceSlug: page.serviceSlug,
    phone: page.phone,
    url: getPageSiteUrl(page),
    offerGroup: getAccountGroup(page),
    title: page.title,
    description: page.description,
  };
}
