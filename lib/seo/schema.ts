import type { Page } from "../pages";
import { getDistrictsList, getPhone, getServiceSlug } from "../pages";
import { getSiteUrl } from "../site";
import { BRAND } from "../service-templates";
import { getBrandLogoUrl } from "../brand";
import { CONTACT_EMAIL, getOfficeAddress, getOfficeForCity } from "../offices";
import { getExtendedFaqs } from "./faqs";
import { getAverageRating, getReviewCount, getServiceReviews } from "./reviews";

function brandLogoAbsoluteUrl(): string {
  const siteUrl = getSiteUrl();
  const logoPath = getBrandLogoUrl();
  return `${siteUrl}${logoPath.startsWith("/") ? logoPath : `/${logoPath}`}`;
}

function buildAddressBlock(page: Page) {
  const address = getOfficeAddress(page.city || "");
  if (!address) return undefined;

  return {
    "@type": "PostalAddress" as const,
    streetAddress: address,
    addressLocality: page.city || "",
    addressCountry: "RU",
  };
}

export function buildBreadcrumbJsonLd(
  page: Page,
  service: string,
  cityPrepositional: string
) {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: `${service} в ${cityPrepositional}`,
        item: `${siteUrl}/${page.slug}`,
      },
    ],
  };
}

export function buildLocalBusinessJsonLd(page: Page) {
  const siteUrl = getSiteUrl();
  const districts = getDistrictsList(page.districts);
  const phone = getPhone(page.phone);
  const rating = getAverageRating(page);
  const reviewCount = getReviewCount(page);
  const address = buildAddressBlock(page);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `${page.service || "Услуга"} в ${page.cityPrepositional || page.city || ""} — ${BRAND}`,
    description: page.description || "",
    telephone: phone,
    email: CONTACT_EMAIL,
    url: `${siteUrl}/${page.slug}`,
    image: brandLogoAbsoluteUrl(),
    openingHours: "Mo-Su 00:00-24:00",
    areaServed: districts.map((district) => ({
      "@type": "Place",
      name: `${district}, ${page.city || ""}`,
    })),
    priceRange: "$$",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: String(rating),
      reviewCount: String(reviewCount),
      bestRating: "5",
      worstRating: "1",
    },
  };

  if (address) {
    jsonLd.address = address;
    const office = getOfficeForCity(page.city || "");
    if (office?.lat && office?.lng) {
      jsonLd.geo = {
        "@type": "GeoCoordinates",
        latitude: office.lat,
        longitude: office.lng,
      };
    }
  }

  return jsonLd;
}

export function buildServiceJsonLd(page: Page) {
  const siteUrl = getSiteUrl();
  const serviceSlug = getServiceSlug(page);
  const address = buildAddressBlock(page);

  const provider: Record<string, unknown> = {
    "@type": "LocalBusiness",
    name: BRAND,
    telephone: getPhone(page.phone),
    email: CONTACT_EMAIL,
    url: siteUrl,
  };

  if (address) {
    provider.address = address;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.service || "Услуга",
    description: page.description || "",
    provider,
    areaServed: {
      "@type": "City",
      name: page.city || "",
    },
    url: `${siteUrl}/${page.slug}`,
    serviceType: serviceSlug,
  };
}

export function buildFaqJsonLd(page: Page) {
  const faqs = getExtendedFaqs(page);
  if (faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function buildReviewJsonLd(page: Page) {
  const reviews = getServiceReviews(page, 5);
  const siteUrl = getSiteUrl();

  return reviews.map((review) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": "LocalBusiness",
      name: `${page.service} в ${page.cityPrepositional || page.city} — ${BRAND}`,
      url: `${siteUrl}/${page.slug}`,
    },
    author: { "@type": "Person", name: review.name },
    reviewRating: {
      "@type": "Rating",
      ratingValue: String(review.rating),
      bestRating: "5",
    },
    reviewBody: review.text,
    datePublished: review.date,
  }));
}

export function buildOrganizationJsonLd(page: Page) {
  const siteUrl = getSiteUrl();
  const phone = getPhone(page.phone);
  const address = buildAddressBlock(page);

  const org: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    url: siteUrl,
    logo: brandLogoAbsoluteUrl(),
    email: CONTACT_EMAIL,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: phone,
      email: CONTACT_EMAIL,
      availableLanguage: "Russian",
      areaServed: "RU",
    },
  };

  if (address) {
    org.address = address;
  }

  return org;
}

export function buildWebsiteJsonLd() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildAllPageJsonLd(page: Page, service: string, cityPrepositional: string) {
  const schemas = [
    buildBreadcrumbJsonLd(page, service, cityPrepositional),
    buildLocalBusinessJsonLd(page),
    buildServiceJsonLd(page),
    buildFaqJsonLd(page),
    buildOrganizationJsonLd(page),
    buildWebsiteJsonLd(),
    ...buildReviewJsonLd(page),
  ].filter(Boolean);

  return schemas;
}
