import type { ProblemArticle } from "../problem-types";
import { getSiteUrl } from "../site";
import { BRAND } from "../service-templates";
import { getBrandLogoUrl } from "../brand";

export function buildProblemBreadcrumbJsonLd(problem: ProblemArticle) {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Типовые проблемы", item: `${siteUrl}/problem` },
      {
        "@type": "ListItem",
        position: 3,
        name: problem.title,
        item: `${siteUrl}/problem/${problem.slug}`,
      },
    ],
  };
}

export function buildProblemArticleJsonLd(problem: ProblemArticle) {
  const siteUrl = getSiteUrl();
  const logoPath = getBrandLogoUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: problem.title,
    description: problem.description,
    datePublished: problem.createdAt,
    dateModified: problem.createdAt,
    author: {
      "@type": "Organization",
      name: BRAND,
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: BRAND,
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}${logoPath.startsWith("/") ? logoPath : `/${logoPath}`}`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/problem/${problem.slug}`,
    },
    about: {
      "@type": "Service",
      name: problem.service,
      areaServed: {
        "@type": "City",
        name: problem.city,
      },
    },
  };
}
