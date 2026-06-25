import type { Page } from "../pages";
import {
  getAllPages,
  getOtherServicesInCity,
  getPopularCitiesForService,
  getServiceSlug,
  formatServiceInCity,
} from "../pages";
import { getPageSeoSections } from "../page-seo";
import { getProblemsForPage } from "../problem";

export interface LinkItem {
  title: string;
  href: string;
}

export interface PageInternalLinks {
  otherServices: LinkItem[];
  nearbyCities: LinkItem[];
  popularServices: LinkItem[];
  blogArticles: LinkItem[];
  problemArticles: LinkItem[];
  brandArticles: LinkItem[];
  popularRequests: LinkItem[];
}

const POPULAR_SERVICE_SLUGS = [
  "santehnik",
  "elektrik",
  "remont-holodilnikov",
  "remont-stiralnyh-mashin",
  "kp",
  "master-na-chas",
  "remont-kondicionerov",
  "remont-televizorov",
  "remont-pmm",
  "remont-vodonagrevatelej",
];

export function getPageInternalLinks(page: Page): PageInternalLinks {
  const city = page.city || "";
  const seo = getPageSeoSections(page);

  const otherServices = getOtherServicesInCity(page, 8).map((p) => ({
    title: formatServiceInCity(p),
    href: `/${p.slug}`,
  }));

  const nearbyCities = getPopularCitiesForService(page, 8).map((p) => ({
    title: `${p.service} в ${p.cityPrepositional || p.city}`,
    href: `/${p.slug}`,
  }));

  const allPages = getAllPages();
  const popularServices: LinkItem[] = [];

  for (const slug of POPULAR_SERVICE_SLUGS) {
    const match = allPages.find(
      (p) => getServiceSlug(p) === slug && p.city === city && p.slug !== page.slug
    );
    if (match) {
      popularServices.push({
        title: formatServiceInCity(match),
        href: `/${match.slug}`,
      });
    }
  }

  const problemArticles: LinkItem[] = getProblemsForPage(page, 6).map((p) => ({
    title: p.problemTitle,
    href: p.href,
  }));

  const blogArticles: LinkItem[] = [];
  const brandArticles: LinkItem[] = [];

  const popularRequests: LinkItem[] = (seo.popularRequests.listItems ?? [])
    .slice(0, 6)
    .map((item) => ({
      title: item,
      href: `/${page.slug}#popular`,
    }));

  return {
    otherServices,
    nearbyCities,
    popularServices,
    blogArticles,
    problemArticles,
    brandArticles,
    popularRequests,
  };
}

export function countInternalLinks(links: PageInternalLinks): number {
  return (
    links.otherServices.length +
    links.nearbyCities.length +
    links.popularServices.length +
    links.blogArticles.length +
    links.problemArticles.length +
    links.brandArticles.length +
    links.popularRequests.length
  );
}
