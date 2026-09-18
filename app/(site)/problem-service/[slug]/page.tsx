import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLdScripts from "@/components/service/JsonLdScripts";
import Breadcrumbs from "@/components/Breadcrumbs";
import CallForm from "@/components/promaster/CallForm";
import SiteScripts from "@/components/promaster/SiteScripts";
import { getAiContent, getAiFaqs } from "@/lib/ai-content";
import {
  getParentSlug,
  getProblemFaqs,
  getProblemPageBySlug,
  getFixSteps,
  getRelatedProblemsSameCity,
  getSameProblemOtherCities,
  type ProblemPage,
} from "@/lib/problems-cluster";
import { getPageBySlug, getPopularCitiesForService, type Page } from "@/lib/pages";
import { getServiceNames, getCityNames } from "@/lib/catalog";
import { buildProblemTitle, buildProblemDescription } from "@/lib/seo/meta";
import { phoneForService } from "@/lib/phones";
import { getExtendedPrices } from "@/lib/seo/prices";
import { getBrandLogoUrl } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site";
import { BRAND } from "@/lib/service-templates";
import { PHOTO_SERVICES } from "@/lib/service-icons";
import { heroBgStyle } from "@/lib/hero-bg";
import { getPrebuildPriority } from "@/lib/prebuild-priority";

interface PageProps { params: Promise<{ slug: string }>; }

export const revalidate = 86400;
export const dynamicParams = true;
// force-static: метадата в <head>, а не в <body> (Яндекс ненадёжно читает мета
// вне head). Динамических данных запроса нет — безопасно.
export const dynamic = "force-static";

// Частичный prebuild приоритетных лендингов (см. lib/prebuild-priority.ts).
export function generateStaticParams() {
  return getPrebuildPriority().problemServicePages.map((slug) => ({ slug }));
}


function capitalize(t: string) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }

function toServicePage(problem: ProblemPage, parent: Page | undefined): Page {
  if (parent) return { ...parent, slug: problem.slug, h1: problem.h1, title: problem.title, description: problem.description };
  return { slug: problem.slug, city: problem.city, cityPrepositional: problem.cityDat, service: problem.service, serviceSlug: problem.serviceSlug, phone: problem.phone, h1: problem.h1, title: problem.title, description: problem.description, price1: "", price2: "", price3: "", price4: "", faq1q: "", faq1a: "", faq2q: "", faq2a: "", faq3q: "", faq3a: "", districts: "" };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getProblemPageBySlug(slug);
  if (!page) return { title: "Страница не найдена" };
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/problem-service/${page.slug}`;
  const ai = getAiContent(page.slug);
  // title/description из единого модуля: несут выгоду («выезд 30 мин», «оплата
  // после работ»), ≤60 / 150-165 симв. Услуга+город всегда в title — иначе одна
  // проблема у разных услуг в одном городе даёт дубли (см. lib/seo/meta.ts).
  const title = buildProblemTitle(page.problem, page.service.toLowerCase(), page.cityDat);
  const description = buildProblemDescription(page.problem, page.service.toLowerCase(), page.cityDat, page.slug);
  // Индекс-гейт: пока нет уникального ИИ-текста — noindex (шаблонный контент
  // без ИИ = тонкий). Как текст сгенерён — страница становится индексируемой.
  const hasUnique = !!(ai && ai.paragraphs && ai.paragraphs.length >= 4);
  return {
    title, description,
    alternates: { canonical: url },
    robots: { index: hasUnique, follow: true },
    openGraph: { title, description, url, type: "website", locale: "ru_RU", siteName: BRAND },
    twitter: { card: "summary_large_image", title, description },
  };
}

function buildJsonLd(page: ProblemPage, faqs: { question: string; answer: string }[]) {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/problem-service/${page.slug}`;
  const parentSlug = getParentSlug(page);
  return [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
      { "@type": "ListItem", position: 2, name: `${page.service} в ${page.cityDat}`, item: `${siteUrl}/${parentSlug}` },
      { "@type": "ListItem", position: 3, name: `${capitalize(page.problem)} в ${page.cityDat}`, item: url },
    ] },
    { "@context": "https://schema.org", "@type": "LocalBusiness", name: `${capitalize(page.problem)} в ${page.cityDat} — ${BRAND}`, description: page.description, telephone: page.phone, url, image: `${siteUrl}${getBrandLogoUrl()}`, openingHours: "Mo-Su 00:00-24:00", priceRange: "$$", areaServed: { "@type": "City", name: page.city } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
  ];
}

const CHECK = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
const ARR = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

export default async function ProblemServicePage({ params }: PageProps) {
  const { slug } = await params;
  const page = getProblemPageBySlug(slug);
  if (!page) notFound();

  const parentSlug = getParentSlug(page);
  const parent = getPageBySlug(parentSlug);
  const servicePage = toServicePage(page, parent);
  const dirPhone = phoneForService(page.serviceSlug);
  const phone = dirPhone.display;
  const phoneHref = dirPhone.href;
  const prices = getExtendedPrices(servicePage) as unknown as Array<Record<string, string>>;
  const faqs = getAiFaqs(page.slug) ?? getProblemFaqs(page);
  const aiContent = getAiContent(page.slug);
  const fixSteps = getFixSteps(page) as unknown as Array<Record<string, string>>;
  const sameCity = getRelatedProblemsSameCity(page, 8).map((p) => ({ slug: p.slug, label: capitalize(p.problem) }));
  const otherCities = getSameProblemOtherCities(page, 8).map((p) => ({ slug: p.slug, label: p.city }));
  const jsonLd = buildJsonLd(page, faqs);
  const heroPhoto = PHOTO_SERVICES.has(page.serviceSlug) ? `/images/promaster/${page.serviceSlug}.jpg` : "/images/promaster/hero.jpg";
  const probCap = capitalize(page.problem);

  return (
    <main>
      <SiteScripts />
      <span id="pm-page-phone" data-href={phoneHref} data-display={phone} hidden />
      <span id="pm-offer-data" data-service={page.service} data-service-slug={page.serviceSlug} data-city={page.city} data-city-prep={page.cityDat} data-slug={page.slug} hidden />
      <JsonLdScripts schemas={jsonLd} />

      {/* HERO */}
      <section className="hero photo" style={heroBgStyle(heroPhoto)}>
        <div className="wrap hero-grid">
          <div>
            <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: `${page.service} в ${page.cityDat}`, href: `/${parentSlug}` }, { label: probCap }]} />
            <span className="eyebrow an d1" style={{ marginTop: 10 }}>{page.service} · {page.city}</span>
            <h1 className="h1 an d2">{page.h1 || `«${probCap}» в ${page.cityDat}`}</h1>
            <p className="lead an d3">Вызовите {page.service.toLowerCase()} на дом — устраним «{page.problem}» за один визит в {page.cityDat}. Диагностика бесплатно.</p>
            <div className="chips an d3">
              <span className="chip">{CHECK}Диагностика бесплатно</span>
              <span className="chip">{CHECK}Гарантия до 12 мес.</span>
              <span className="chip">{CHECK}Выезд 24/7</span>
            </div>
            <div className="hero-cta an d4">
              <a className="btn btn-accent" href="#lead-form">Вызвать мастера{ARR}</a>
              <span className="rating">{CHECK} <b style={{ color: "var(--ink)" }}>Оплата после работ</b></span>
            </div>
            <div className="live an d5"><span className="gdot" /><span>Принимаем заявки круглосуточно в {page.cityDat}</span></div>
          </div>
          <CallForm services={getServiceNames()} cities={getCityNames()} defaultService={page.service} defaultCity={page.city} slug={page.slug} source="problem" />
        </div>
      </section>

      {/* RIBBON */}
      <div className="ribbon"><div className="track">
        {[0, 1].map((k) => (<span key={k} style={{ display: "flex", gap: 40 }}>
          {["Мастера проверены", "Договор и чек", "Оплата после работ", "Выезд 24/7 за 30 минут", "Гарантия до 12 месяцев"].map((t) => (<span className="tr-item" key={t}>{CHECK}{t}</span>))}
        </span>))}
      </div></div>

      {/* FIX STEPS */}
      {fixSteps.length > 0 && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Как это работает</span><h2>Как мы устраняем «{page.problem}» в {page.cityDat}</h2></div>
          <div className="steps stg">
            {fixSteps.slice(0, 4).map((s, i) => (
              <div className="step" key={i}><div className="n">{s.step || String(i + 1)}</div><h3>{s.title}</h3><p>{s.desc || s.text}</p></div>
            ))}
          </div>
        </div></section>
      )}

      {/* SEO TEXT (AI) */}
      {aiContent && aiContent.paragraphs.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Разбор</span><h2>«{probCap}»: причины и решение</h2></div>
          <div className="seo-wrap rv">
            <div className="seotext">{aiContent.paragraphs.map((t, i) => <p key={i}>{t}</p>)}</div>
            <aside className="seo-facts">
              <div className="sf-photo" style={{ backgroundImage: `url(${heroPhoto})` }} />
              <div className="sf-body"><h3>Коротко</h3>
                <ul className="facts-ic">
                  <li><span className="fi"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 01-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 015.4-5.4l-2.7 2.7-2-2 2.7-2.7z" /></svg></span><span>Услуга <b>{page.service}</b></span></li>
                  <li><span className="fi"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.3-7-11a7 7 0 0114 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg></span><span>Город <b>{page.city}</b></span></li>
                  <li><span className="fi"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v5l3 2" /><path d="M12 22a10 10 0 100-20 10 10 0 000 20" /></svg></span><span>Выезд <b>30 минут</b></span></li>
                  <li><span className="fi"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></span><span>Диагностика <b>бесплатно</b></span></li>
                  <li><span className="fi"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></span><span>Гарантия <b>до 12 мес.</b></span></li>
                </ul>
              </div>
            </aside>
          </div>
        </div></section>
      )}

      {/* PRICES */}
      {prices.length > 0 && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Цены</span><h2>Стоимость: {page.service.toLowerCase()} в {page.cityDat}</h2></div>
          <div className="prices" style={{ maxWidth: 760 }}>
            {prices.slice(0, 7).map((p, i) => (
              <div className="prow" key={i}><span className="pname">{p.label || p.name || p.service || p.title}</span><span className="pdots" /><span className="pval">{p.price || p.value || "по запросу"}</span></div>
            ))}
            <div className="prow"><span className="pname">Диагностика и выезд</span><span className="pdots" /><span className="pval pfree">бесплатно</span></div>
          </div>
        </div></section>
      )}

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
      <section className="blk"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">Похожие</span><h2>Другие проблемы в {page.cityDat}</h2>
          <p><Link href={`/${parentSlug}`} style={{ color: "var(--accent-ink)", fontWeight: 700 }}>← Все услуги: {page.service} в {page.cityDat}</Link></p></div>
        {sameCity.length > 0 && (
          <div className="city-grid rv" style={{ marginBottom: otherCities.length ? 30 : 0 }}>
            {sameCity.map((p) => (
              <Link className="ccard" href={`/problem-service/${p.slug}`} key={p.slug}><span><b>{p.label}</b><small>в {page.cityDat}</small></span>
                <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
            ))}
          </div>
        )}
        {otherCities.length > 0 && (
          <>
            <div className="sec-head rv" style={{ marginTop: 8 }}><h2 style={{ fontSize: "clamp(20px,2.6vw,26px)" }}>«{probCap}» в других городах</h2></div>
            <div className="city-grid rv">
              {otherCities.map((p) => (
                <Link className="ccard" href={`/problem-service/${p.slug}`} key={p.slug}><span><b>{p.label}</b><small>{probCap}</small></span>
                  <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
              ))}
            </div>
          </>
        )}
      </div></section>

      {/* BAND */}
      <section className="blk how" style={{ paddingTop: 6 }}><div className="wrap"><div className="band rv">
        <div className="deco" aria-hidden />
        <span className="eyebrow" style={{ color: "var(--accent-2)" }}>Нужен мастер прямо сейчас?</span>
        <h2 style={{ marginTop: 12 }}>Устраним «{page.problem}» в {page.cityDat} — выезд за 30 минут</h2>
        <p>Круглосуточно, без выходных. Диагностика бесплатно, оплата после выполнения работ.</p>
        <a className="btn btn-accent" href={phoneHref}>{phone}</a>
      </div></div></section>
    </main>
  );
}
