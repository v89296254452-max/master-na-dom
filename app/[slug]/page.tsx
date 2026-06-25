import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LeadForm from "@/components/LeadForm";
import OtherServices from "@/components/OtherServices";
import PopularCities from "@/components/PopularCities";
import BenefitsGrid from "@/components/service/BenefitsGrid";
import BrandsBlock from "@/components/service/BrandsBlock";
import Breadcrumbs from "@/components/service/Breadcrumbs";
import CasesBlock from "@/components/service/CasesBlock";
import ContactsBlock from "@/components/service/ContactsBlock";
import DistrictsBlock from "@/components/service/DistrictsBlock";
import ExtendedPriceTable from "@/components/service/ExtendedPriceTable";
import FailureReasonsBlock from "@/components/service/FailureReasonsBlock";
import FaqSection from "@/components/service/FaqSection";
import InternalLinksSection from "@/components/service/InternalLinksSection";
import JsonLdScripts from "@/components/service/JsonLdScripts";
import RepairTimeline from "@/components/service/RepairTimeline";
import ReviewsBlock from "@/components/service/ReviewsBlock";
import SeoExtraContent from "@/components/service/SeoExtraContent";
import SeoListSection from "@/components/service/SeoListSection";
import SeoUniqueText from "@/components/service/SeoUniqueText";
import ServiceCards from "@/components/service/ServiceCards";
import ServiceGallery from "@/components/service/ServiceGallery";
import ServiceHero from "@/components/service/ServiceHero";
import StickyCallBar from "@/components/service/StickyCallBar";
import TrustStatsBlock from "@/components/service/TrustStatsBlock";
import TypicalProblemsBlock from "@/components/service/TypicalProblemsBlock";
import {
  getPageBySlug,
  getPhone,
  getPhoneHref,
  getServiceSlug,
  getOtherServicesInCity,
  getPopularCitiesForService,
} from "@/lib/pages";
import { getPageSeoSections } from "@/lib/page-seo";
import { getServiceBrands } from "@/lib/seo/brands";
import { getServiceCases } from "@/lib/seo/cases";
import { getPageDistricts } from "@/lib/seo/districts";
import { getExtendedFaqs } from "@/lib/seo/faqs";
import { getFailureReasons } from "@/lib/seo/failures";
import { getPageInternalLinks } from "@/lib/seo/internal-links";
import { getProblemsForPage } from "@/lib/problem";
import { getExtendedPrices } from "@/lib/seo/prices";
import { getServiceReviews } from "@/lib/seo/reviews";
import { buildAllPageJsonLd } from "@/lib/seo/schema";
import { getSiteUrl } from "@/lib/site";
import { getServiceCards } from "@/lib/service-ui";
import { getHeroVisual, getWorkGallery } from "@/lib/images";
import { getBrandLogoUrl } from "@/lib/brand";
import { REPAIR_STEPS } from "@/lib/seo/constants";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageBySlug(slug);

  if (!page) {
    return { title: "Страница не найдена" };
  }

  const siteUrl = getSiteUrl();

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: `${siteUrl}/${page.slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${siteUrl}/${page.slug}`,
      type: "website",
      locale: "ru_RU",
      siteName: "ПроМастер",
      images: [
        {
          url: `${siteUrl}/${page.slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${page.service} в ${page.cityPrepositional || page.city} — ПроМастер`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [`${siteUrl}/${page.slug}/opengraph-image`],
    },
  };
}

export default async function ServicePage({ params }: PageProps) {
  const { slug } = await params;
  const page = getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const phone = getPhone(page.phone);
  const phoneHref = getPhoneHref(phone);
  const serviceSlug = getServiceSlug(page);
  const districtLinks = getPageDistricts(page);
  const extendedPrices = getExtendedPrices(page);
  const extendedFaqs = getExtendedFaqs(page);
  const serviceCards = getServiceCards(page);
  const seoSections = getPageSeoSections(page);
  const otherServices = getOtherServicesInCity(page);
  const popularCitiesCount = Math.max(10, 15 - otherServices.length);
  const popularCities = getPopularCitiesForService(page, popularCitiesCount);
  const cityPrepositional = page.cityPrepositional || page.city || "";
  const service = page.service || "Услуга";
  const failures = getFailureReasons(page);
  const brands = getServiceBrands(serviceSlug);
  const reviews = getServiceReviews(page, 10);
  const heroVisual = getHeroVisual(page);
  const workGallery = getWorkGallery(page);
  const logoSrc = getBrandLogoUrl();
  const cases = getServiceCases(page, 4);
  const internalLinks = getPageInternalLinks(page);
  const typicalProblems = getProblemsForPage(page, 8);
  const jsonLd = buildAllPageJsonLd(page, service, cityPrepositional);

  return (
    <>
      <JsonLdScripts schemas={jsonLd} />

      <div className="min-h-screen pb-24 md:pb-0 bg-gray-light/30">
        <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10 space-y-8 sm:space-y-10">
          <Breadcrumbs service={service} cityPrepositional={cityPrepositional} />

          <ServiceHero
            page={page}
            phone={phone}
            phoneHref={phoneHref}
            logoSrc={logoSrc}
            heroVisual={heroVisual}
          />

          <BenefitsGrid />

          <ContactsBlock city={page.city || ""} phone={phone} phoneHref={phoneHref} />

          <SeoUniqueText
            title={seoSections.uniqueText.title}
            paragraphs={seoSections.uniqueText.paragraphs}
          />

          <FailureReasonsBlock block={failures} />

          <TypicalProblemsBlock
            problems={typicalProblems}
            service={service}
            cityPrepositional={cityPrepositional}
            targetUrl={`/${page.slug}`}
            phone={phone}
            phoneHref={phoneHref}
          />

          <ServiceCards service={service} cards={serviceCards} />

          <ExtendedPriceTable prices={extendedPrices} />

          <CasesBlock cases={cases} />

          <RepairTimeline steps={REPAIR_STEPS} />

          <ServiceGallery items={workGallery} />

          <TrustStatsBlock />

          <BrandsBlock brands={brands} />

          <SeoListSection
            title={seoSections.typicalProblems.title}
            intro={seoSections.typicalProblems.paragraphs}
            items={seoSections.typicalProblems.listItems}
          />

          <SeoListSection
            title={seoSections.beforeCallChecklist.title}
            intro={seoSections.beforeCallChecklist.paragraphs}
            items={seoSections.beforeCallChecklist.listItems}
          />

          <SeoListSection
            id="popular"
            title={seoSections.popularRequests.title}
            intro={seoSections.popularRequests.paragraphs}
            items={seoSections.popularRequests.listItems}
          />

          <DistrictsBlock
            cityPrepositional={cityPrepositional}
            districts={districtLinks}
          />

          <ReviewsBlock reviews={reviews} />

          <FaqSection faqs={extendedFaqs} />

          <OtherServices
            cityPrepositional={cityPrepositional}
            services={otherServices}
          />

          <PopularCities service={service} pages={popularCities} />

          <InternalLinksSection links={internalLinks} />

          <section
            id="lead-form"
            className="scroll-mt-6 rounded-2xl bg-navy p-6 sm:p-8 text-white shadow-xl"
          >
            <h2 className="text-xl font-bold sm:text-2xl">Оставить заявку</h2>
            <p className="mt-2 text-white/80 text-sm sm:text-base">
              Опишите проблему — мастер перезвонит в течение 5 минут
            </p>
            <div className="mt-6 rounded-xl bg-white p-5 sm:p-6">
              <LeadForm
                service={service}
                city={page.city || ""}
                cityPrepositional={cityPrepositional}
                slug={page.slug || ""}
              />
            </div>
          </section>

          <SeoExtraContent blocks={seoSections.supplementaryBlocks} />
        </main>

        <StickyCallBar phone={phone} phoneHref={phoneHref} />
      </div>
    </>
  );
}
