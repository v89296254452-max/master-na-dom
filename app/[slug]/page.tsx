import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LeadForm from "@/components/LeadForm";
import OtherServices from "@/components/OtherServices";
import PopularCities from "@/components/PopularCities";
import Breadcrumbs from "@/components/service/Breadcrumbs";
import DistrictsBlock from "@/components/service/DistrictsBlock";
import FaqSection from "@/components/service/FaqSection";
import HowWeWork from "@/components/service/HowWeWork";
import PriceTable from "@/components/service/PriceTable";
import SeoExtraContent from "@/components/service/SeoExtraContent";
import SeoListSection from "@/components/service/SeoListSection";
import SeoUniqueText from "@/components/service/SeoUniqueText";
import ServiceCards from "@/components/service/ServiceCards";
import ServiceHero from "@/components/service/ServiceHero";
import StickyCallBar from "@/components/service/StickyCallBar";
import {
  getAllPages,
  getPageBySlug,
  getOtherServicesInCity,
  getPopularCitiesForService,
  getPhone,
  getPhoneHref,
  getDistrictsList,
  getPrices,
  getFaqs,
  type Page,
} from "@/lib/pages";
import { getPageSeoSections } from "@/lib/page-seo";
import { getSiteUrl } from "@/lib/site";
import { getServiceCards } from "@/lib/service-ui";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPages().map((page) => ({ slug: page.slug }));
}

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
    },
  };
}

function BreadcrumbJsonLd({
  page,
  service,
  cityPrepositional,
}: {
  page: Page;
  service: string;
  cityPrepositional: string;
}) {
  const siteUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Главная",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `${service} в ${cityPrepositional}`,
        item: `${siteUrl}/${page.slug}`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function LocalBusinessJsonLd({ page }: { page: Page }) {
  const siteUrl = getSiteUrl();
  const districts = getDistrictsList(page.districts);
  const phone = getPhone(page.phone);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `${page.service || "Услуга"} в ${page.cityPrepositional || page.city || ""}`,
    description: page.description || "",
    telephone: phone,
    url: `${siteUrl}/${page.slug}`,
    areaServed: districts.map((district) => ({
      "@type": "Place",
      name: `${district}, ${page.city || ""}`,
    })),
    priceRange: "$$",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function FaqJsonLd({ page }: { page: Page }) {
  const faqs = getFaqs(page);

  if (faqs.length === 0) {
    return null;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function ServicePage({ params }: PageProps) {
  const { slug } = await params;
  const page = getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const phone = getPhone(page.phone);
  const phoneHref = getPhoneHref(phone);
  const districts = getDistrictsList(page.districts);
  const prices = getPrices(page);
  const faqs = getFaqs(page);
  const serviceCards = getServiceCards(page);
  const seoSections = getPageSeoSections(page);
  const otherServices = getOtherServicesInCity(page);
  const popularCitiesCount = Math.max(10, 15 - otherServices.length);
  const popularCities = getPopularCitiesForService(page, popularCitiesCount);
  const cityPrepositional = page.cityPrepositional || page.city || "";
  const service = page.service || "Услуга";

  return (
    <>
      <BreadcrumbJsonLd page={page} service={service} cityPrepositional={cityPrepositional} />
      <LocalBusinessJsonLd page={page} />
      <FaqJsonLd page={page} />

      <div className="min-h-screen pb-24 md:pb-0">
        <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
          <Breadcrumbs service={service} cityPrepositional={cityPrepositional} />

          <ServiceHero page={page} phone={phone} phoneHref={phoneHref} />

          <SeoUniqueText
            title={seoSections.uniqueText.title}
            paragraphs={seoSections.uniqueText.paragraphs}
          />

          <ServiceCards service={service} cards={serviceCards} />

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
            title={seoSections.popularRequests.title}
            intro={seoSections.popularRequests.paragraphs}
            items={seoSections.popularRequests.listItems}
          />

          {prices.length > 0 && <PriceTable prices={prices} />}

          <HowWeWork />

          <DistrictsBlock
            cityPrepositional={cityPrepositional}
            districts={districts}
          />

          {faqs.length > 0 && <FaqSection faqs={faqs} />}

          <OtherServices
            cityPrepositional={cityPrepositional}
            services={otherServices}
          />

          <PopularCities service={service} pages={popularCities} />

          <section
            id="lead-form"
            className="scroll-mt-6 rounded-2xl bg-navy p-6 sm:p-8 text-white"
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
