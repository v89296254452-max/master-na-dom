import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import { getAllCities, getCityGroup } from "@/lib/catalog";
import { buildCityHubTitle, buildCityHubDescription } from "@/lib/seo/meta";
import { getProblemPagesByCity } from "@/lib/problems-cluster";
import { getSiteUrl } from "@/lib/site";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return getAllCities().map((c) => ({ city: c.citySlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const group = getCityGroup(city);
  if (!group) return {};
  const title = buildCityHubTitle(group.cityPrepositional);
  const description = buildCityHubDescription(group.cityPrepositional, group.pages.map((p) => p.service.toLowerCase()));
  return {
    title,
    description,
    alternates: { canonical: `/goroda/${city}` },
    openGraph: { title, description, url: `${getSiteUrl()}/goroda/${city}`, type: "website" },
  };
}

export default async function CityHubPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const group = getCityGroup(city);
  if (!group) notFound();

  // Частые поломки в этом городе — перелинковка на кластер /problem-service/.
  const cityProblems = getProblemPagesByCity(group.city).slice(0, 18);

  return (
    <main>
      <SiteScripts />
      <span id="pm-offer-data" data-city={group.city} data-city-prep={group.cityPrepositional} hidden />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Города", href: "/goroda" }, { label: group.city }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">Город</span>
          <h1>Мастер на дом в {group.cityPrepositional}</h1>
          <p>Все услуги мастеров в {group.cityPrepositional} — выберите нужную, посмотрите цены и вызовите специалиста. Выезд от 30 минут.</p>
        </div>
        <div className="city-grid rv">
          {group.pages.map((p) => (
            <Link className="ccard" href={`/${p.slug}`} key={p.slug}>
              <span><b>{p.service}</b><small>в {group.cityPrepositional}</small></span>
              <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          ))}
        </div>
      </div></section>

      {cityProblems.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">С чем обращаются</span><h2>Частые поломки в {group.cityPrepositional}</h2>
            <p>Опишите проблему — подберём мастера с нужным опытом. Выезд от 30 минут.</p></div>
          <div className="prob-grid stg">
            {cityProblems.map((pr) => (
              <Link className="prob" href={`/problem-service/${pr.slug}`} key={pr.slug}>
                <span className="pi"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg></span>
                <b>{pr.problem} — {pr.service.toLowerCase()}</b>
                <svg className="arr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
        </div></section>
      )}
    </main>
  );
}
