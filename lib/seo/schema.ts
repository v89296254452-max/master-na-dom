import type { Page } from "../pages";
import { getDistrictsList, getPhone, getServiceSlug } from "../pages";
import { getSiteUrl } from "../site";
import { BRAND } from "../service-templates";
import { getBrandLogoUrl } from "../brand";
import { CONTACT_EMAIL, getOfficeAddress, getOfficeForCity } from "../offices";
import { getExtendedFaqs, VISIBLE_FAQ_LIMIT } from "./faqs";
import { getExtendedPrices } from "./prices";
import { getRealAggregate, getRealReviews } from "./real-reviews";

/** Первое целое число из строки цены («от 1 200 ₽» → 1200). */
/**
 * Число из строки цены — только если это ДЕНЬГИ (есть ₽/руб).
 * Без этой проверки «Гарантия: до 12 месяцев» превращалась в Offer на 12 ₽ и
 * ломала lowPrice в AggregateOffer (в сниппете «от 12 ₽» вместо «от 600 ₽»).
 * «бесплатно»/«без доплат» тоже не цены — вернут null.
 */
function parsePriceNumber(value: string): number | null {
  const v = value || "";
  if (!/₽|руб/i.test(v)) return null;
  const digits = v.replace(/\s/g, "").match(/\d+/);
  return digits ? parseInt(digits[0], 10) : null;
}

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
  const serviceSlug = getServiceSlug(page);

  // 4 уровня — синхронно с видимыми крошками на странице (иначе Google
  // игнорирует крошку в сниппете при рассинхроне).
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Услуги", item: `${siteUrl}/uslugi` },
      { "@type": "ListItem", position: 3, name: service, item: `${siteUrl}/uslugi/${serviceSlug}` },
      {
        "@type": "ListItem",
        position: 4,
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
  const address = buildAddressBlock(page);

  // AggregateRating/Review — ТОЛЬКО из реальных отзывов (data/real-reviews.json).
  // Нет данных → разметки рейтинга нет: выдуманные звёзды = ручная санкция.
  // Как появятся реальные отзывы (Яндекс.Бизнес) — включится автоматически.
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
  };

  const agg = getRealAggregate(page.city, page.serviceSlug);
  if (agg) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: agg.ratingValue,
      reviewCount: agg.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
    const rs = getRealReviews(page.city, page.serviceSlug).slice(0, 5);
    if (rs.length) {
      jsonLd.review = rs.map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.author },
        datePublished: r.date,
        reviewBody: r.text,
        reviewRating: { "@type": "Rating", ratingValue: String(r.rating), bestRating: "5", worstRating: "1" },
      }));
    }
  }

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
    ...buildServiceOffers(page),
  };
}

/** Прайс услуги → OfferCatalog + AggregateOffer с минимальной ценой. */
function buildServiceOffers(page: Page): Record<string, unknown> {
  const rows = getExtendedPrices(page)
    .map((r) => ({ name: r.name, price: parsePriceNumber(r.value) }))
    .filter((r): r is { name: string; price: number } => r.price !== null && r.price > 0);
  if (rows.length === 0) return {};

  const low = Math.min(...rows.map((r) => r.price));
  return {
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "RUB",
      lowPrice: low,
      offerCount: rows.length,
      offers: rows.slice(0, 15).map((r) => ({
        "@type": "Offer",
        name: r.name,
        priceCurrency: "RUB",
        price: r.price,
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "RUB",
          minPrice: r.price,
        },
      })),
    },
  };
}

export function buildFaqJsonLd(page: Page) {
  // ТОЛЬКО видимые на странице вопросы: getExtendedFaqs отдаёт до 35, а рендерится
  // VISIBLE_FAQ_LIMIT. Разметка со скрытыми вопросами = невалидный rich-сниппет.
  const faqs = getExtendedFaqs(page).slice(0, VISIBLE_FAQ_LIMIT);
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

// buildReviewJsonLd удалён: строил Review-разметку из ПРОГРАММНО сгенерённых
// (фейковых) отзывов. Реальные отзывы теперь идут через lib/seo/real-reviews.ts
// и подключаются в buildLocalBusinessJsonLd только при наличии данных.

export function buildOrganizationJsonLd(page?: Page) {
  const siteUrl = getSiteUrl();
  const phone = getPhone(page?.phone);
  const address = page ? buildAddressBlock(page) : undefined;

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

  // Соцпрофили и юр-реквизиты — из env (задать, когда появятся):
  //   ORG_SAMEAS="https://vk.com/...,https://dzen.ru/..."
  //   ORG_LEGAL_NAME="ИП Иванов И.И."   ORG_INN="1234567890"
  const sameAs = (process.env.ORG_SAMEAS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (sameAs.length) org.sameAs = sameAs;
  if (process.env.ORG_LEGAL_NAME) org.legalName = process.env.ORG_LEGAL_NAME;
  if (process.env.ORG_INN) org.taxID = process.env.ORG_INN;

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
    // Review-разметку намеренно не включаем (см. buildLocalBusinessJsonLd).
  ].filter(Boolean);

  return schemas;
}
