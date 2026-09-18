import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import { notFound } from "next/navigation";
import JsonLdScripts from "@/components/service/JsonLdScripts";
import Breadcrumbs from "@/components/Breadcrumbs";
import CallForm from "@/components/promaster/CallForm";
import PriceCalculator from "@/components/promaster/PriceCalculator";
import SiteScripts from "@/components/promaster/SiteScripts";
import {
  getPageBySlug,
  getServiceSlug,
  getOtherServicesInCity,
  getPopularCitiesForService,
} from "@/lib/pages";
import { getServiceNames, getCityNames } from "@/lib/catalog";
import { getPageSeoSections } from "@/lib/page-seo";
import { getAiContent, getIndexableSlugSet } from "@/lib/ai-content";
import { phoneForService } from "@/lib/phones";
import { getPageDistricts } from "@/lib/seo/districts";
import { getExtendedFaqs, VISIBLE_FAQ_LIMIT } from "@/lib/seo/faqs";
import { getExtendedPrices } from "@/lib/seo/prices";
import { getProblemsForPage } from "@/lib/problem";
import { getProblemPagesForServiceCity } from "@/lib/problems-cluster";
import { buildAllPageJsonLd } from "@/lib/seo/schema";
import { getSiteUrl } from "@/lib/site";
import { PHOTO_SERVICES } from "@/lib/service-icons";
import { getWorkPhotos } from "@/lib/seo/work-photos";
import { buildCityIntro } from "@/lib/seo/city-content";
import { heroBgStyle } from "@/lib/hero-bg";
import { buildGeoTitle, buildGeoDescription, buildBrandTitle, buildBrandDescription } from "@/lib/seo/meta";
import MapFacade from "@/components/promaster/MapFacade";
import SvgSprite, { Icon } from "@/components/SvgSprite";
import { getBrandPageBySlug } from "@/lib/brand-pages";
import { getBrandsForService } from "@/lib/brands";
import { getCitySlug } from "@/lib/catalog";
import { getPrebuildPriority } from "@/lib/prebuild-priority";
import BrandPageView from "./BrandPageView";

interface PageProps { params: Promise<{ slug: string }>; }

export const revalidate = 86400;
export const dynamicParams = true;
// force-static: рендерить без стриминга, чтобы метадата (canonical/description/
// robots/og) попадала в <head>, а не в <body> (Яндекс ненадёжно читает мета вне
// head). Динамических данных запроса на странице нет — безопасно.
export const dynamic = "force-static";

// Частичный prebuild приоритетных страниц (см. lib/prebuild-priority.ts) —
// устраняет cold-start штраф для «денежных» URL, не трогая остальные ~50k+
// (они остаются on-demand ISR, как и были). Пустой whitelist = [] = текущее
// поведение без изменений.
export function generateStaticParams() {
  return getPrebuildPriority().brandPages.map((slug) => ({ slug }));
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) {
    // бренд-страница «ремонт {техника} {бренд} {город}»
    const bp = getBrandPageBySlug(slug);
    if (!bp) return { title: "Страница не найдена" };
    const siteUrl = getSiteUrl();
    const ai = getAiContent(bp.slug);
    // title/description из единого модуля: несут выгоду («оплата после работ»),
    // ≤60 / 150-165 симв., уникальны (см. lib/seo/meta.ts).
    const title = buildBrandTitle(bp.service, bp.brand, bp.cityDat);
    const description = buildBrandDescription(bp.service, bp.brand, bp.cityDat, bp.slug);
    const hasUnique = !!(ai && ai.paragraphs && ai.paragraphs.length >= 4);
    return {
      title, description,
      alternates: { canonical: `${siteUrl}/${bp.slug}` },
      robots: { index: hasUnique, follow: true },
      openGraph: { title, description, url: `${siteUrl}/${bp.slug}`, type: "website", locale: "ru_RU", siteName: "ПроМастер" },
      twitter: { card: "summary", title, description },
    };
  }
  const siteUrl = getSiteUrl();
  const ai = getAiContent(page.slug);
  const description = buildGeoDescription(page.service, page.cityPrepositional || page.city || "", page.slug);
  const title = buildGeoTitle(page.service, page.cityPrepositional || page.city || "");
  // Гейт индексации: гео-страницы без уникального ИИ-текста (~900 из 4185)
  // раньше индексировались с шаблонным near-dup «спиннером» — теперь noindex
  // до появления реального текста (как у брендов/проблемных).
  const hasUnique = !!(ai && ai.paragraphs && ai.paragraphs.length >= 4);
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/${page.slug}` },
    robots: { index: hasUnique, follow: true },
    openGraph: {
      title, description, url: `${siteUrl}/${page.slug}`, type: "website", locale: "ru_RU", siteName: "ПроМастер",
      images: [{ url: `${siteUrl}/${page.slug}/opengraph-image`, width: 1200, height: 630, alt: `${page.service} в ${page.cityPrepositional || page.city} — ПроМастер` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${siteUrl}/${page.slug}/opengraph-image`] },
  };
}

// Иконки — из спрайта (<use>): было 92 инлайн-svg при 25 уникальных.
const CHECK = <Icon name="check" />;
const ARR = <Icon name="arr" />;
const PIN = <svg width="16" height="16" className="ic" aria-hidden><use href="#i-pin-dot" /></svg>;

// Блок «коротко» — значки + подписи (по правке Дмитрия)
const fsvg = (d: string) => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{d.split("|").map((p, i) => <path key={i} d={p} />)}</svg>;
const FACTS = [
  { ic: fsvg("M12 7v5l3 2|M12 22a10 10 0 100-20 10 10 0 000 20"), label: "Выезд за", val: "30 минут" },
  { ic: fsvg("M20 6L9 17l-5-5"), label: "Диагностика", val: "бесплатно" },
  { ic: fsvg("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"), label: "Гарантия", val: "до 12 мес." },
  { ic: fsvg("M12 22a10 10 0 100-20 10 10 0 000 20|M12 7v5l3 2"), label: "Работаем", val: "24/7" },
  { ic: fsvg("M2 7h20v12H2z|M2 11h20|M6 15h4"), label: "Оплата", val: "после работ" },
];


export default async function ServicePage({ params }: PageProps) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) {
    // не гео-страница? пробуем бренд-страницу «ремонт {техника} {бренд} {город}»
    const bp = getBrandPageBySlug(slug);
    if (bp) return <BrandPageView bp={bp} />;
    notFound();
  }

  const service = page.service || "Услуга";
  const cityDat = page.cityPrepositional || page.city || "городе";
  const city = page.city || "";
  const serviceSlug = getServiceSlug(page);
  const dirPhone = phoneForService(serviceSlug);
  const phone = dirPhone.display;
  const phoneHref = dirPhone.href;
  const prices = getExtendedPrices(page) as unknown as Array<Record<string, string>>;
  const faqs = getExtendedFaqs(page);
  const districts = getPageDistricts(page);
  const seo = getPageSeoSections(page);
  // Приоритет — гео-специфичные проблемные страницы /problem-service/ этой
  // услуги в этом городе (иначе кластер 11 684 стр. остаётся без входящих
  // ссылок). Если у услуги нет кластера — фолбэк на статьи /problem/.
  const clusterProblems = getProblemPagesForServiceCity(serviceSlug, city, 8);
  const problems = getProblemsForPage(page, 6) as unknown as Array<Record<string, string>>;
  const citySlug = getCitySlug(page);
  // M8: линкуем только бренды с реальным контентом в этом городе (индексируемые),
  // не гоня робота/юзера на noindex-фолбэки (8 673 бренд-страниц без ИИ-текста).
  const indexableSlugs = getIndexableSlugSet();
  const brands = getBrandsForService(serviceSlug).filter((b) =>
    citySlug ? indexableSlugs.has(`${serviceSlug}-${b.slug}-${citySlug}`) : false
  );
  const otherServices = getOtherServicesInCity(page, 8);
  const otherCities = getPopularCitiesForService(page, 12);
  const jsonLd = buildAllPageJsonLd(page, service, cityDat);
  const heroPhoto = PHOTO_SERVICES.has(serviceSlug) ? `/images/promaster/${serviceSlug}.jpg` : "/images/promaster/hero.jpg";
  // набор иллюстраций уникален для города (ротация по хешу slug), а не один
  // и тот же {service}-1..6 на всех страницах — см. lib/seo/work-photos.ts
  const workPhotos = getWorkPhotos(serviceSlug, page.slug, 6);
  // LCP: preload hero-картинки (AVIF) — фон ставится JS'ом, preload-сканер его не видит.
  preload(heroPhoto.replace(/\.jpg$/, ".avif"), { as: "image", type: "image/avif", fetchPriority: "high" });

  return (
    <main>
      <SvgSprite />
      <SiteScripts />
      <span id="pm-page-phone" data-href={phoneHref} data-display={phone} hidden />
      <span id="pm-offer-data" data-service={service} data-service-slug={serviceSlug} data-city={page.city} data-city-prep={cityDat} data-slug={page.slug} hidden />
      <JsonLdScripts schemas={jsonLd} />

      {/* HERO */}
      <section className="hero photo" style={heroBgStyle(heroPhoto)}>
        <div className="wrap hero-grid">
          <div>
            <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Услуги", href: "/uslugi" }, { label: service, href: `/uslugi/${serviceSlug}` }, { label: `${service} в ${cityDat}` }]} />
            <span className="eyebrow an d1" style={{ marginTop: 10 }}>{service} на дом · {city}</span>
            <h1 className="h1 an d2">{page.h1 || `${service} в ${cityDat}`}</h1>
            <p className="lead an d3">{buildCityIntro(service, city, cityDat, page.slug)}</p>
            <div className="chips an d3">
              <span className="chip">{CHECK}Диагностика бесплатно</span>
              <span className="chip">{CHECK}Гарантия до 12 мес.</span>
              <span className="chip">{CHECK}Работаем 24/7</span>
            </div>
            <div className="hero-cta an d4">
              <a className="btn btn-accent" href="#lead-form">Вызвать мастера{ARR}</a>
              <span className="rating">{CHECK} <b style={{ color: "var(--ink)" }}>Оплата после работ</b> · договор и чек</span>
            </div>
            <div className="live an d5"><span className="gdot" /><span>Принимаем заявки круглосуточно в {cityDat}</span></div>
          </div>
          <CallForm services={getServiceNames()} cities={getCityNames()} defaultService={service} defaultCity={city} slug={page.slug} source="seo" />
        </div>
      </section>

      {/* RIBBON */}
      <div className="ribbon"><div className="track">
        {[0, 1].map((k) => (
          <span key={k} style={{ display: "flex", gap: 40 }}>
            {["Мастера проверены", "Договор и чек", "Оплата после работ", "Выезд 24/7 за 30 минут", "Гарантия до 12 месяцев"].map((t) => (<span className="tr-item" key={t}>{CHECK}{t}</span>))}
          </span>
        ))}
      </div></div>

      {/* CALCULATOR */}
      <section className="blk"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">Сколько это стоит</span><h2>Рассчитайте примерную цену</h2>
          <p>Честная вилка ещё до звонка. Точную цену мастер назовёт после бесплатной диагностики.</p></div>
        <PriceCalculator defaultService={service} />
      </div></section>

      {/* PRICES */}
      {prices.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Цены</span><h2>Стоимость услуг: {service.toLowerCase()} в {cityDat}</h2>
            <p>Ориентир по популярным работам. Точную цену мастер называет до начала и фиксирует.</p></div>
          <div className="prices-wrap rv">
            <div className="prices">
              {prices.slice(0, 200).map((p, i) => (
                <div className="prow" key={i}>
                  <span className="pname">{p.label || p.name || p.service || p.title}</span>
                  <span className="pdots" />
                  <span className="pval">{p.price || p.value || "по запросу"}</span>
                </div>
              ))}
              <div className="prow"><span className="pic pic-free">{CHECK}</span><span className="pname">Диагностика и выезд мастера</span><span className="pdots" /><span className="pval pfree">бесплатно</span></div>
            </div>
            <aside className="price-side">
              <div className="ps-photo" style={{ backgroundImage: `url(${heroPhoto})` }} />
              <div className="ps-body">
                <h3>Не нашли нужную работу?</h3>
                <p>Назовём точную цену по телефону — бесплатно, за пару минут.</p>
                <a className="btn btn-accent" href="#lead-form" style={{ width: "100%" }}>Узнать цену{ARR}</a>
                <ul className="ps-trust">
                  <li>{CHECK}Диагностика бесплатно</li>
                  <li>{CHECK}Цена фиксируется до работ</li>
                  <li>{CHECK}Оплата после выполнения</li>
                </ul>
              </div>
            </aside>
          </div>
        </div></section>
      )}

      {/* PROBLEMS */}
      {(clusterProblems.length > 0 || problems.length > 0) && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">С чем обращаются</span><h2>Частые поломки: {service.toLowerCase()} в {cityDat}</h2>
            <p>Опишите, что случилось — подберём мастера с нужным опытом.</p></div>
          <div className="prob-grid stg">
            {clusterProblems.length > 0
              ? clusterProblems.map((pr) => (
                  <Link className="prob" href={`/problem-service/${pr.slug}`} key={pr.slug}>
                    <span className="pi"><Icon name="warn" size={21} /></span>
                    <b>{pr.problem}</b>
                    <Icon name="arr" className="arr" size={16} />
                  </Link>
                ))
              : problems.map((pr, i) => (
                  <Link className="prob" href={pr.href || `/problem/${pr.slug}`} key={i}>
                    <span className="pi"><Icon name="warn" size={21} /></span>
                    <b>{pr.title || pr.problem || pr.label || pr.name}</b>
                    <Icon name="arr" className="arr" size={16} />
                  </Link>
                ))}
          </div>
        </div></section>
      )}

      {/* BRANDS */}
      {brands.length > 0 && citySlug && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">По брендам</span><h2>{service} по маркам в {cityDat}</h2>
            <p>Ремонтируем технику всех популярных брендов — выберите свою марку.</p></div>
          <div className="city-grid rv">
            {brands.map((b) => (
              <Link className="ccard" href={`/${serviceSlug}-${b.slug}-${citySlug}`} key={b.slug}>
                <span><b>{b.name}</b><small>{service.toLowerCase()}</small></span>
                <Icon name="arr" className="arr" size={17} />
              </Link>
            ))}
          </div>
        </div></section>
      )}

      {/* КАК ОТБИРАЕМ МАСТЕРОВ — честные принципы, без выдуманных персон/рейтингов */}
      <section className="blk how"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">Кто приедет</span><h2>Проверенные мастера в {cityDat}</h2>
          <p>Отбираем исполнителей по чётким правилам — вы получаете специалиста с опытом, а не случайного человека по объявлению.</p></div>
        <div className="mast-grid stg">
          {[
            { ic: "M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z M9 12l2 2 4-4", t: "Проверка документов", d: "Паспорт и опыт подтверждены до допуска к заявкам." },
            { ic: "M12 8v5l3 2 M12 22a10 10 0 100-20 10 10 0 000 20", t: "Профильный опыт", d: "Мастера с реальной практикой именно по нужному направлению." },
            { ic: "M20 6L9 17l-5-5", t: "Гарантия на работы", d: "На выполненный ремонт даётся гарантия до 12 месяцев." },
            { ic: "M2 7h20v12H2z M2 11h20 M6 15h4", t: "Оплата после", d: "Сначала результат и чек — потом оплата. Цена фиксируется заранее." },
          ].map((m) => (
            <div className="mast" key={m.t} style={{ padding: 20 }}>
              <span className="fi" style={{ display: "inline-grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent-ink)", marginBottom: 12 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{m.ic.split(" M").map((d, i) => <path key={i} d={(i ? "M" : "") + d} />)}</svg>
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{m.t}</h3>
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>{m.d}</p>
            </div>
          ))}
        </div>
      </div></section>

      {/* НАШИ РАБОТЫ — реальные фото с объектов (доверие/конверсия) */}
      {workPhotos.length > 0 && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">Как выглядит работа</span><h2>{service} на дому — как это происходит</h2>
            <p>Фото процесса: так проходит работа мастера на объекте.</p></div>
          <div className="workgal rv">
            {workPhotos.map((src, i) => (
              <figure className="wph" key={i}>
                <picture>
                  <source srcSet={`${src}.avif`} type="image/avif" />
                  <source srcSet={`${src}.webp`} type="image/webp" />
                  <img src={`${src}.jpg`} alt={`${service} в ${cityDat} — фото: работа мастера, этап ${i + 1}`} loading="lazy" width={800} height={500} />
                </picture>
                <figcaption><span className="wtag">фото</span></figcaption>
              </figure>
            ))}
          </div>
        </div></section>
      )}

      {/* SEO TEXT */}
      {seo.uniqueText.paragraphs.length > 0 && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">О сервисе</span><h2>{service} на дом в {cityDat}</h2></div>
          <div className="seo-wrap rv">
            <div className="seotext">{seo.uniqueText.paragraphs.map((t, i) => <p key={i}>{t}</p>)}</div>
            <aside className="seo-facts">
              <div className="sf-photo" style={{ backgroundImage: `url(${heroPhoto})` }} />
              <div className="sf-body"><h3>{service} — коротко</h3>
                <ul className="facts-ic">
                  {FACTS.map((f, i) => (
                    <li key={i}><span className="fi">{f.ic}</span><span>{f.label} <b>{f.val}</b></span></li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div></section>
      )}

      {/* DISTRICTS */}
      {districts.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">География по городу</span><h2>Куда выезжаем в {cityDat}</h2></div>
          <div className="districts-wrap rv">
            <div className="dist-info">
              <span className="di-ic">{PIN}</span>
              <b>Весь город + пригород</b>
              <p>Выезжаем во все районы без наценки за отдалённость. Мастер рядом приедет в среднем за 30 минут.</p>
              <a className="btn btn-accent" href="#lead-form" style={{ width: "100%" }}>Вызвать в свой район{ARR}</a>
            </div>
            <div className="dist-grid">
              {districts.slice(0, 12).map((d, i) => (
                <Link className="dcard" href={d.href || "#"} key={i}><span className="dp">{PIN}</span>{d.name}</Link>
              ))}
            </div>
          </div>
        </div></section>
      )}

      {/* MAP (локальный блок для индексации) */}
      {city && (
        <section className="blk"><div className="wrap">
          <div className="sec-head rv"><span className="eyebrow">На карте</span><h2>{service} в {cityDat} на карте</h2>
            <p>Работаем во всех районах и пригороде. Мастер приедет по вашему адресу — в среднем за 30 минут, диагностика бесплатно.</p></div>
          <div className="map-wrap rv">
            <MapFacade city={city} title={`${service} в ${cityDat} — карта зоны выезда`} />
          </div>
        </div></section>
      )}

      {/* Отзывы намеренно не выводим: реальных отзывов пока нет, а выдуманные —
          риск ручных санкций Яндекса/Google. Появятся из Яндекс.Бизнеса. */}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="blk how"><div className="wrap">
          <div className="faq2 rv">
            <div className="faq2-side"><span className="eyebrow">Вопросы и ответы</span><h2>Отвечаем честно</h2>
              <p>Не нашли свой вопрос — позвоните, подскажем бесплатно.</p>
              <a className="btn btn-accent" href={phoneHref} style={{ marginTop: 6 }}>Позвонить</a>
            </div>
            <div className="faq2-list">
              {faqs.slice(0, VISIBLE_FAQ_LIMIT).map((f, i) => (
                <details className="qa" key={i} open={i === 0}>
                  <summary>{f.question}<span className="qi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span></summary>
                  <div className="ans">{f.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </div></section>
      )}

      {/* INTERNAL: other services + other cities */}
      {(otherServices.length > 0 || otherCities.length > 0) && (
        <section className="blk"><div className="wrap">
          {otherServices.length > 0 && (
            <>
              <div className="sec-head rv"><span className="eyebrow">Ещё в {cityDat}</span><h2>Другие услуги мастеров</h2></div>
              <div className="city-grid rv" style={{ marginBottom: 34 }}>
                {citySlug && (
                  <Link className="ccard" href={`/goroda/${citySlug}`}><span><b>Все услуги в {city}</b><small>каталог города</small></span>
                    <Icon name="arr" className="arr" size={17} /></Link>
                )}
                {otherServices.map((p) => (
                  <Link className="ccard" href={`/${p.slug}`} key={p.slug}><span><b>{p.service}</b><small>в {cityDat}</small></span>
                    <Icon name="arr" className="arr" size={17} /></Link>
                ))}
              </div>
            </>
          )}
          {otherCities.length > 0 && (
            <>
              <div className="sec-head rv"><span className="eyebrow">Другие города</span><h2>{service} в других городах</h2></div>
              <div className="city-grid rv">
                {otherCities.map((p) => (
                  <Link className="ccard" href={`/${p.slug}`} key={p.slug}><span><b>{p.city}</b><small>{service}</small></span>
                    <Icon name="arr" className="arr" size={17} /></Link>
                ))}
              </div>
            </>
          )}
        </div></section>
      )}

      {/* BAND */}
      <section className="blk how" style={{ paddingTop: 6 }}><div className="wrap"><div className="band rv">
        <div className="deco" aria-hidden />
        <span className="eyebrow" style={{ color: "var(--accent-2)" }}>Нужен мастер прямо сейчас?</span>
        <h2 style={{ marginTop: 12 }}>{service} в {cityDat} — выезд за 30 минут</h2>
        <p>Круглосуточно, без выходных. Диагностика бесплатно, оплата после выполнения работ.</p>
        <a className="btn btn-accent" href={phoneHref}>{phone}</a>
      </div></div></section>
    </main>
  );
}
