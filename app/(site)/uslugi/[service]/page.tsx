import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import { getAllServices, getServiceGroup } from "@/lib/catalog";
import { buildServiceHubTitle, buildServiceHubDescription } from "@/lib/seo/meta";
import { getProblemPagesByService } from "@/lib/problems-cluster";
import { getSiteUrl } from "@/lib/site";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return getAllServices().map((s) => ({ service: s.serviceSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service } = await params;
  const group = getServiceGroup(service);
  if (!group) return {};
  const title = buildServiceHubTitle(group.service, group.pages.length);
  const description = buildServiceHubDescription(group.service, group.pages.length);
  return {
    title,
    description,
    alternates: { canonical: `/uslugi/${service}` },
    openGraph: { title, description, url: `${getSiteUrl()}/uslugi/${service}`, type: "website" },
  };
}

export default async function ServiceHubPage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  const group = getServiceGroup(service);
  if (!group) notFound();

  // Частые поломки по услуге — перелинковка на кластер /problem-service/.
  const serviceProblems = getProblemPagesByService(service).slice(0, 18);

  return (
    <main>
      <SiteScripts />
      <span id="pm-offer-data" data-service={group.service} data-service-slug={service} hidden />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Услуги", href: "/uslugi" }, { label: group.service }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">Услуга по городам</span>
          <h1>{group.service} на дом</h1>
          <p>Вызовите мастера ({group.service.toLowerCase()}) на дом в любом из {group.pages.length} городов России. Выберите свой город:</p>
        </div>
        <div className="city-grid rv">
          {group.pages.map((p) => (
            <Link className="ccard" href={`/${p.slug}`} key={p.slug}>
              <span><b>{p.city}</b><small>{group.service}</small></span>
              <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          ))}
        </div>
      </div></section>

      {serviceProblems.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">С чем обращаются</span><h2>Частые поломки: {group.service.toLowerCase()}</h2>
            <p>Типовые неисправности, с которыми вызывают мастера. Выберите свою — расскажем причины и цену.</p></div>
          <div className="prob-grid stg">
            {serviceProblems.map((pr) => (
              <Link className="prob" href={`/problem-service/${pr.slug}`} key={pr.slug}>
                <span className="pi"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg></span>
                <b>{pr.problem} — {pr.city}</b>
                <svg className="arr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
        </div></section>
      )}
    </main>
  );
}
