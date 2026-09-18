import Link from "next/link";
import { preload } from "react-dom";
import JsonLdScripts from "@/components/service/JsonLdScripts";
import Breadcrumbs from "@/components/Breadcrumbs";
import CallForm from "@/components/promaster/CallForm";
import SiteScripts from "@/components/promaster/SiteScripts";
import { phoneForService } from "@/lib/phones";
import { getExtendedPrices } from "@/lib/seo/prices";
import { getExtendedFaqs } from "@/lib/seo/faqs";
import { getAiContent, getIndexableSlugSet } from "@/lib/ai-content";
import { getBrandsForService } from "@/lib/brands";
import { getServiceNames, getCityNames } from "@/lib/catalog";
import { getProblemPagesForServiceCity } from "@/lib/problems-cluster";
import {
  buildServiceJsonLd,
  buildLocalBusinessJsonLd,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
} from "@/lib/seo/schema";
import { getSiteUrl } from "@/lib/site";
import { PHOTO_SERVICES } from "@/lib/service-icons";
import { getWorkPhotos } from "@/lib/seo/work-photos";
import { heroBgStyle } from "@/lib/hero-bg";
import type { BrandPage } from "@/lib/brand-pages";

const CHECK = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
const ARR = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

/** Фолбэк-текст бренд-страницы (пока нет ИИ-текста) — грамматически безопасный. */
function fallbackParagraphs(bp: BrandPage): string[] {
  const s = bp.service.toLowerCase();
  return [
    `Служба «ПроМастер» выполняет ремонт техники ${bp.brand} в ${bp.cityDat} с выездом на дом. Мастер по направлению «${s}» приезжает со специнструментом и типовыми запчастями под технику ${bp.brand}, диагностика бесплатна при выполнении работ.`,
    `Мы ремонтируем технику ${bp.brand} на дому в ${bp.cityDat}: выезд от 30 минут, работаем круглосуточно. Стоимость мастер называет до начала работ и фиксирует её — без «доплат по факту». На выполненные работы действует гарантия до 12 месяцев.`,
    `Заказать ремонт ${bp.brand} в ${bp.cityDat} можно по телефону ${phoneForService(bp.serviceSlug).display} или через форму на сайте. Диспетчер перезвонит в течение 5 минут, уточнит модель и характер неисправности, подберёт профильного мастера.`,
  ];
}

export default function BrandPageView({ bp }: { bp: BrandPage }) {
  const ai = getAiContent(bp.slug);
  const paragraphs = ai?.paragraphs?.length ? ai.paragraphs : fallbackParagraphs(bp);
  const dirPhone = phoneForService(bp.serviceSlug);
  const prices = getExtendedPrices(bp.parent) as unknown as Array<Record<string, string>>;
  const faqs = getExtendedFaqs(bp.parent);
  const problems = getProblemPagesForServiceCity(bp.serviceSlug, bp.city, 8);
  // M8: только бренды с реальным контентом в этом городе (индексируемые) —
  // не линкуем noindex-фолбэки.
  const indexableSlugs = getIndexableSlugSet();
  const otherBrands = getBrandsForService(bp.serviceSlug)
    .filter((b) => b.slug !== bp.brandSlug && indexableSlugs.has(`${bp.serviceSlug}-${b.slug}-${bp.citySlug}`))
    .slice(0, 12);
  const heroPhoto = PHOTO_SERVICES.has(bp.serviceSlug) ? `/images/promaster/${bp.serviceSlug}.jpg` : "/images/promaster/hero.jpg";
  preload(heroPhoto.replace(/\.jpg$/, ".avif"), { as: "image", type: "image/avif", fetchPriority: "high" });
  const workPhotos = getWorkPhotos(bp.serviceSlug, bp.slug, 6);

  const siteUrl = getSiteUrl();
  const h1 = `Ремонт ${bp.service.replace(/^Ремонт\s+/i, "").toLowerCase()} ${bp.brand} в ${bp.cityDat}`;
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Услуги", item: `${siteUrl}/uslugi` },
        { "@type": "ListItem", position: 3, name: bp.service, item: `${siteUrl}/uslugi/${bp.serviceSlug}` },
        { "@type": "ListItem", position: 4, name: `${bp.service} в ${bp.cityDat}`, item: `${siteUrl}/${bp.parent.slug}` },
        { "@type": "ListItem", position: 5, name: bp.brand, item: `${siteUrl}/${bp.slug}` },
      ],
    },
    buildServiceJsonLd(bp.parent),
    // M9: раньше здесь были только Breadcrumb+Service — без FAQPage/
    // Organization/WebSite/полного LocalBusiness, которые есть на
    // гео-услуге (page.tsx). Из-за этого 31к бренд-страниц были заметно
    // беднее по разметке, чем 2.5к money-страниц. Используем те же
    // билдеры на родительской гео-странице (bp.parent).
    buildLocalBusinessJsonLd(bp.parent),
    buildFaqJsonLd(bp.parent),
    buildOrganizationJsonLd(bp.parent),
    buildWebsiteJsonLd(),
  ].filter(Boolean);

  return (
    <main>
      <SiteScripts />
      <span id="pm-page-phone" data-href={dirPhone.href} data-display={dirPhone.display} hidden />
      <span id="pm-offer-data" data-service={bp.service} data-service-slug={bp.serviceSlug} data-city={bp.city} data-city-prep={bp.cityDat} data-slug={bp.slug} hidden />
      <JsonLdScripts schemas={jsonLd} />

      <section className="hero photo" style={heroBgStyle(heroPhoto)}>
        <div className="wrap hero-grid">
          <div>
            <Breadcrumbs items={[
              { label: "Главная", href: "/" },
              { label: "Услуги", href: "/uslugi" },
              { label: bp.service, href: `/uslugi/${bp.serviceSlug}` },
              { label: `${bp.service} в ${bp.cityDat}`, href: `/${bp.parent.slug}` },
              { label: bp.brand },
            ]} />
            <span className="eyebrow an d1" style={{ marginTop: 10 }}>{bp.service} {bp.brand} · {bp.city}</span>
            <h1 className="h1 an d2">{h1}</h1>
            <p className="lead an d3">Мастер по ремонту техники {bp.brand} приедет на дом в {bp.cityDat}. Выезд от 30 минут, диагностика бесплатно, гарантия до 12 месяцев.</p>
            <div className="chips an d3">
              <span className="chip">{CHECK}Оригинальные запчасти {bp.brand}</span>
              <span className="chip">{CHECK}Диагностика бесплатно</span>
              <span className="chip">{CHECK}Гарантия до 12 мес.</span>
            </div>
            <div className="hero-cta an d4">
              <a className="btn btn-accent" href="#lead-form">Вызвать мастера{ARR}</a>
              <span className="rating">{CHECK} <b style={{ color: "var(--ink)" }}>Ремонт {bp.brand}</b>&nbsp;· оплата после работ</span>
            </div>
          </div>
          <CallForm services={getServiceNames()} cities={getCityNames()} defaultService={bp.service} defaultCity={bp.city} slug={bp.slug} source="brand" />
        </div>
      </section>

      <section className="blk"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">О сервисе</span><h2>Ремонт {bp.brand} в {bp.cityDat} на дому</h2></div>
        <div className="seo-wrap rv">
          <div className="seotext">{paragraphs.map((t, i) => <p key={i}>{t}</p>)}</div>
          <aside className="seo-facts">
            <div className="sf-photo" style={{ backgroundImage: `url(${heroPhoto})` }} />
            <div className="sf-body"><h3>Коротко</h3>
              <ul>
                <li>Бренд <b>{bp.brand}</b></li>
                <li>Город <b>{bp.city}</b></li>
                <li>Выезд <b>30 минут</b></li>
                <li>Диагностика <b>бесплатно</b></li>
                <li>Гарантия <b>до 12 мес.</b></li>
              </ul>
              <a className="btn btn-accent" href={dirPhone.href} style={{ width: "100%", marginTop: 14, justifyContent: "center" }}>{dirPhone.display}</a>
            </div>
          </aside>
        </div>
      </div></section>

      {prices.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Цены</span><h2>Сколько стоит ремонт {bp.brand} в {bp.cityDat}</h2>
            <p>Ориентир по ценам. Точную стоимость мастер называет после бесплатной диагностики.</p></div>
          <div className="prices-wrap rv"><div className="prices">
            {prices.slice(0, 200).map((p, i) => (
              <div className="prow" key={i}><span className="pname">{p.name || p.label}</span><span className="pdots" /><span className="pval">{p.value || p.price || "по запросу"}</span></div>
            ))}
          </div></div>
        </div></section>
      )}

      {workPhotos.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Как выглядит работа</span><h2>Ремонт {bp.brand} в {bp.cityDat} — как это происходит</h2>
            <p>Фото процесса: этапы работы мастера на объекте.</p></div>
          <div className="workgal rv">
            {workPhotos.map((src, i) => (
              <figure className="wph" key={i}>
                <picture>
                  <source srcSet={`${src}.avif`} type="image/avif" />
                  <source srcSet={`${src}.webp`} type="image/webp" />
                  <img src={`${src}.jpg`} alt={`Ремонт ${bp.brand} в ${bp.cityDat} — фото: работа мастера, этап ${i + 1}`} loading="lazy" width={800} height={500} />
                </picture>
                <figcaption><span className="wtag">фото</span></figcaption>
              </figure>
            ))}
          </div>
        </div></section>
      )}

      {problems.length > 0 && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">С чем обращаются</span><h2>Частые поломки {bp.brand} в {bp.cityDat}</h2></div>
          <div className="prob-grid stg">
            {problems.map((pr) => (
              <Link className="prob" href={`/problem-service/${pr.slug}`} key={pr.slug}>
                <span className="pi"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg></span>
                <b>{pr.problem}</b>
                <svg className="arr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
        </div></section>
      )}

      {faqs.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="faq2 rv">
            <div className="faq2-side"><span className="eyebrow">Вопросы и ответы</span><h2>Частые вопросы</h2>
              <a className="btn btn-accent" href={dirPhone.href} style={{ marginTop: 6 }}>{dirPhone.display}</a></div>
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

      {otherBrands.length > 0 && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Другие бренды</span><h2>Ремонт других марок в {bp.cityDat}</h2></div>
          <div className="city-grid rv">
            <Link className="ccard" href={`/goroda/${bp.citySlug}`}>
              <span><b>Все услуги в {bp.city}</b><small>каталог города</small></span>
              <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            {otherBrands.map((b) => (
              <Link className="ccard" href={`/${bp.serviceSlug}-${b.slug}-${bp.citySlug}`} key={b.slug}>
                <span><b>{b.name}</b><small>{bp.service.toLowerCase()}</small></span>
                <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
        </div></section>
      )}
    </main>
  );
}
