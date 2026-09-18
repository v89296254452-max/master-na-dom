import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import JsonLdScripts from "@/components/service/JsonLdScripts";
import Breadcrumbs from "@/components/Breadcrumbs";
import CallForm from "@/components/promaster/CallForm";
import SiteScripts from "@/components/promaster/SiteScripts";
import { getProblemBySlug, getRelatedProblems, getRelatedServicesForProblem } from "@/lib/problem";
import { getServiceNames, getCityNames } from "@/lib/catalog";
import { getProblemPagesForServiceCity } from "@/lib/problems-cluster";
import { getIndexableSlugSet } from "@/lib/ai-content";
import { buildProblemArticleJsonLd, buildProblemBreadcrumbJsonLd } from "@/lib/seo/problem-schema";
import { getSiteUrl } from "@/lib/site";
import { BRAND } from "@/lib/service-templates";
import { phoneForService } from "@/lib/phones";
import { PHOTO_SERVICES } from "@/lib/service-icons";
import { getPrebuildPriority } from "@/lib/prebuild-priority";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400;
export const dynamicParams = true;
export const dynamic = "force-static"; // метадата в <head> (Яндекс)

// Частичный prebuild приоритетных статей (см. lib/prebuild-priority.ts).
export function generateStaticParams() {
  return getPrebuildPriority().problemPages.map((slug) => ({ slug }));
}


const CHECK = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
const ARR = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const problem = getProblemBySlug(slug);
  if (!problem) return { title: "Страница не найдена" };

  const siteUrl = getSiteUrl();
  // Каннибализация: если существует /problem-service/ лендинг на ту же
  // проблему+услугу+город (строгое совпадение), консолидируем сигнал —
  // canonical со статьи на более сильный коммерческий лендинг (их 29k, они в
  // кластере перелинковки). Статья остаётся доступной (не noindex), но не
  // конкурирует с лендингом за один запрос.
  const pk = problem.problemKey || "";
  const indexable = getIndexableSlugSet();
  const psMatch = pk
    ? getProblemPagesForServiceCity(problem.serviceSlug, problem.city, 500).find(
        (ps) =>
          (ps.problemSlug === pk || ps.problemSlug.startsWith(pk + "-") || pk.startsWith(ps.problemSlug + "-")) &&
          indexable.has(ps.slug)
      )
    : undefined;
  const canonical = psMatch ? `${siteUrl}/problem-service/${psMatch.slug}` : `${siteUrl}/problem/${problem.slug}`;
  return {
    title: `${problem.title} | ${BRAND}`,
    description: problem.description,
    alternates: { canonical },
    openGraph: {
      title: problem.title,
      description: problem.description,
      url: `${siteUrl}/problem/${problem.slug}`,
      type: "article",
      locale: "ru_RU",
      siteName: BRAND,
    },
    twitter: { card: "summary", title: problem.title, description: problem.description },
  };
}

export default async function ProblemDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const problem = getProblemBySlug(slug);
  if (!problem) notFound();

  const dirPhone = phoneForService(problem.serviceSlug);
  const phone = dirPhone.display;
  const phoneHref = dirPhone.href;
  const heroPhoto = PHOTO_SERVICES.has(problem.serviceSlug) ? `/images/promaster/${problem.serviceSlug}.jpg` : "/images/promaster/hero.jpg";
  const relatedProblems = getRelatedProblems(problem, 6);
  const relatedServices = getRelatedServicesForProblem(problem, 5);
  const faqs = problem.faqs.map((f) => ({ question: f.q, answer: f.a }));
  const cityDat = problem.cityPrepositional || problem.city;

  const jsonLd = [buildProblemBreadcrumbJsonLd(problem), buildProblemArticleJsonLd(problem)];

  return (
    <main>
      <SiteScripts />
      <span id="pm-page-phone" data-href={phoneHref} data-display={phone} hidden />
      <JsonLdScripts schemas={jsonLd} />

      {/* HERO */}
      <section className="hero" data-photo={heroPhoto}>
        <div className="wrap hero-grid">
          <div>
            <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Проблемы", href: "/problem" }, { label: problem.problemTitle }]} />
            <span className="eyebrow an d1" style={{ marginTop: 10 }}>{problem.service} · {problem.city}</span>
            <h1 className="h1 an d2">{problem.title}</h1>
            <p className="lead an d3">{problem.description}</p>
            <div className="chips an d3">
              <span className="chip">{CHECK}Диагностика бесплатно</span>
              <span className="chip">{CHECK}Гарантия до 12 мес.</span>
              <span className="chip">{CHECK}Выезд 24/7</span>
            </div>
            <div className="hero-cta an d4">
              <a className="btn btn-accent" href="#lead-form">Вызвать мастера{ARR}</a>
              <span className="rating"><span className="stars">★★★★★</span> <b className="tnum" style={{ color: "var(--ink)" }}>4.8</b></span>
            </div>
            <div className="live an d5"><span className="gdot" /><span><b className="tnum" id="pm-online">12</b> мастеров онлайн в {cityDat}</span></div>
          </div>
          <CallForm services={getServiceNames()} cities={getCityNames()} defaultService={problem.service} defaultCity={problem.city} slug={problem.slug} source="problem" />
        </div>
      </section>

      {/* RIBBON */}
      <div className="ribbon"><div className="track">
        {[0, 1].map((k) => (<span key={k} style={{ display: "flex", gap: 40 }}>
          {["Мастера проверены", "Договор и чек", "Оплата после работ", "Выезд 24/7 за 30 минут", "Гарантия до 12 месяцев"].map((t) => (<span className="tr-item" key={t}>{CHECK}{t}</span>))}
        </span>))}
      </div></div>

      {/* WHY + FACTS */}
      {problem.whyHappens && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Разбор</span><h2>«{problem.problemTitle}»: почему возникает</h2></div>
          <div className="seo-wrap rv">
            <div className="seotext"><p>{problem.whyHappens}</p></div>
            <aside className="seo-facts">
              <div className="sf-photo" style={{ backgroundImage: `url(${heroPhoto})` }} />
              <div className="sf-body"><h3>Коротко</h3>
                <ul>
                  <li>Услуга <b>{problem.service}</b></li>
                  <li>Город <b>{problem.city}</b></li>
                  <li>Выезд <b>30 минут</b></li>
                  <li>Диагностика <b>бесплатно</b></li>
                  <li>Стоимость <b>{problem.priceHint}</b></li>
                </ul>
              </div>
            </aside>
          </div>
        </div></section>
      )}

      {/* SELF-CHECK + WHEN CALL */}
      {(problem.selfCheck.length > 0 || problem.whenCall.length > 0) && (
        <section className="blk how"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Что делать</span><h2>Самопроверка и когда звать мастера</h2></div>
          <div className="two-col rv">
            {problem.selfCheck.length > 0 && (
              <div className="info-card">
                <h3>Можно проверить самому</h3>
                <ul className="ps-trust">
                  {problem.selfCheck.map((item) => (<li key={item}>{CHECK}{item}</li>))}
                </ul>
              </div>
            )}
            {problem.whenCall.length > 0 && (
              <div className="info-card warn">
                <h3>Когда вызывать мастера</h3>
                <ul className="warn-list">
                  {problem.whenCall.map((item) => (<li key={item}>{item}</li>))}
                </ul>
              </div>
            )}
          </div>
        </div></section>
      )}

      {/* PRICE */}
      <section className="blk"><div className="wrap"><div className="band rv">
        <div className="deco" aria-hidden />
        <span className="eyebrow" style={{ color: "var(--accent-2)" }}>Стоимость решения</span>
        <h2 style={{ marginTop: 12 }}>{problem.priceHint}</h2>
        <p>Точную цену мастер называет после осмотра. Диагностика бесплатна при выполнении работ.</p>
        <a className="btn btn-accent" href={phoneHref}>{phone}</a>
      </div></div></section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="faq2 rv">
            <div className="faq2-side"><span className="eyebrow">Вопросы и ответы</span><h2>Частые вопросы</h2>
              <p>Не нашли свой вопрос — позвоните, подскажем бесплатно.</p>
              <a className="btn btn-accent" href={phoneHref} style={{ marginTop: 6 }}>Позвонить</a>
            </div>
            <div className="faq2-list">
              {faqs.slice(0, 6).map((f, i) => (
                <details className="qa" key={i} open={i === 0}>
                  <summary>{f.question}<span className="qi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span></summary>
                  <div className="ans">{f.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </div></section>
      )}

      {/* RELATED */}
      {(relatedProblems.length > 0 || relatedServices.length > 0) && (
        <section className="blk"><div className="wrap">
          {relatedProblems.length > 0 && (
            <>
              <div className="sec-head rv"><span className="eyebrow">Похожие</span><h2>Другие проблемы в {cityDat}</h2></div>
              <div className="city-grid rv" style={{ marginBottom: relatedServices.length ? 30 : 0 }}>
                {relatedProblems.map((item) => (
                  <Link className="ccard" href={item.href} key={item.href}><span><b>{item.title}</b><small>в {cityDat}</small></span>
                    <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
                ))}
              </div>
            </>
          )}
          {relatedServices.length > 0 && (
            <>
              <div className="sec-head rv" style={{ marginTop: 8 }}><h2 style={{ fontSize: "clamp(20px,2.6vw,26px)" }}>Услуги мастеров в {cityDat}</h2></div>
              <div className="city-grid rv">
                {relatedServices.map((item) => (
                  <Link className="ccard" href={item.href} key={item.href}><span><b>{item.title}</b><small>в {cityDat}</small></span>
                    <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
                ))}
              </div>
            </>
          )}
        </div></section>
      )}
    </main>
  );
}
