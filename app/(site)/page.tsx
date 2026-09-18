import Link from "next/link";
import type { Metadata } from "next";
import { preload } from "react-dom";
import { getAllServices, getAllCities, getServiceNames, getCityNames } from "@/lib/catalog";
import CallForm from "@/components/promaster/CallForm";
import PriceCalculator from "@/components/promaster/PriceCalculator";
import SiteScripts from "@/components/promaster/SiteScripts";
import JsonLdScripts from "@/components/service/JsonLdScripts";
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo/schema";
import { DEFAULT_PHONE } from "@/lib/phones";
import { PHOTO_SERVICES, Ic } from "@/lib/service-icons";
import { heroBgStyle } from "@/lib/hero-bg";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "ПроМастер — вызов мастера на дом в 150 городах России",
  description:
    "Вызов проверенного мастера на дом: сантехник, электрик, ремонт бытовой техники. Работаем в 150 городах России, выезд от 30 минут, честные цены. Мастер перезвонит в течение 5 минут.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", title: "ПроМастер — вызов мастера на дом", description: "Сантехник, электрик, ремонт техники в 150 городах России. Выезд от 30 минут.", url: "/" },
};


const WORKS = [
  { t: "Замена смесителя", c: "Сантехник · Москва", img: "work-faucet" },
  { t: "Ремонт электропроводки", c: "Электрик · Казань", img: "work-panel" },
  { t: "Ремонт стиральной машины", c: "Ремонт техники · СПб", img: "work-washer" },
];

const FAQS = [
  ["Сколько стоит вызов мастера?", "Вызов и диагностика — бесплатно при выполнении работ. Стоимость самой работы зависит от услуги и сложности, мастер называет точную цену до начала и фиксирует её. Ориентир можно прикинуть в калькуляторе выше."],
  ["Как быстро приедет мастер?", "В среднем 30–60 минут после заявки. Работаем круглосуточно, 24/7 — при срочной поломке отправляем ближайшего мастера в приоритете."],
  ["Нужно ли платить предоплату?", "Нет. Оплата только после того, как работа выполнена и вы её приняли. Диагностика бесплатна при ремонте."],
  ["Даёте ли гарантию?", "Да, на выполненные работы и установленные детали — до 12 месяцев. Если проблема вернулась в этот срок, приезжаем и устраняем бесплатно."],
  ["А вдруг я смогу починить сам?", "Иногда — да, и мы честно подскажем как. Если случай простой, не станем навязывать вызов."],
  ["Работаете официально?", "Да — по договору, с чеком. Мастеров проверяем: паспорт, опыт, отзывы. Вы видите рейтинг и специализацию до вызова."],
];

const CHECK = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
const ARR = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

export default function HomePage() {
  // LCP: preload hero-картинки в <head> (фон ставится JS'ом, preload-сканер
  // его не видит — без этого старт загрузки LCP задержан на мобайле).
  preload("/images/promaster/hero.avif", { as: "image", type: "image/avif", fetchPriority: "high" });

  const services = getAllServices();
  // Флагманская сетка «Популярные услуги»: сначала услуги с реальным фото
  // (единый вид карточек), добираем остальными до 8.
  const popularServices = [
    ...services.filter((s) => PHOTO_SERVICES.has(s.serviceSlug)),
    ...services.filter((s) => !PHOTO_SERVICES.has(s.serviceSlug)),
  ].slice(0, 8);
  const cities = getAllCities();
  const formServices = getServiceNames();
  const formCities = getCityNames();

  // JSON-LD главной: Organization (+sameAs/ИНН из env), WebSite, FAQPage.
  const jsonLd = [
    buildOrganizationJsonLd(),
    buildWebsiteJsonLd(),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];

  return (
    <main>
      <SiteScripts />
      <JsonLdScripts schemas={jsonLd} />

      {/* HERO */}
      <section className="hero photo" style={heroBgStyle("/images/promaster/hero.jpg")}>
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow an d1">Мастера на дом · {cities.length} городов России</span>
            <h1 className="h1 an d2">Мастер приедет и всё<br /><span className="u">починит сегодня</span></h1>
            <p className="lead an d3">Сантехник, электрик, ремонт бытовой техники. Проверенные мастера с гарантией — выезд от 30 минут, цена известна заранее.</p>
            <div className="chips an d3">
              <span className="chip">{CHECK}Диагностика бесплатно</span>
              <span className="chip">{CHECK}Гарантия до 12 мес.</span>
              <span className="chip">{CHECK}Оплата после работ</span>
            </div>
            <div className="hero-cta an d4">
              <a className="btn btn-accent" href="#lead-form">Вызвать мастера{ARR}</a>
              <span className="rating">{CHECK} <b style={{ color: "var(--ink)" }}>Оплата после работ</b> · договор и чек</span>
            </div>
            <div className="live an d5"><span className="gdot" /><span>Принимаем заявки круглосуточно</span></div>
            <div className="hero-trust an d5">
              <div><b className="tnum">{cities.length}</b><span>городов России</span></div>
              <div><b className="tnum">до 30 мин</b><span>выезд мастера</span></div>
              <div><b>Официально</b><span>договор и чек</span></div>
            </div>
          </div>
          <CallForm services={formServices} cities={formCities} />
        </div>
      </section>

      {/* RIBBON */}
      <div className="ribbon"><div className="track">
        {[0, 1].map((k) => (
          <span key={k} style={{ display: "flex", gap: 40 }}>
            {["Мастера проверены", "Договор и чек", "Оплата после работ", "Выезд 24/7 за 30 минут", "Гарантия до 12 месяцев", "Работаем официально"].map((t) => (
              <span className="tr-item" key={t}>{CHECK}{t}</span>
            ))}
          </span>
        ))}
      </div></div>

      {/* PROOF */}
      <div className="proof"><div className="wrap"><div className="proof-grid rv" data-count>
        <div><div className="num tnum" data-to={cities.length}>0</div><div className="lbl">городов России</div></div>
        <div><div className="num tnum" data-to="30" data-suf=" мин">0</div><div className="lbl">средний выезд</div></div>
        <div><div className="num tnum" data-to={services.length}>0</div><div className="lbl">видов услуг</div></div>
        <div><div className="num tnum" data-to="12" data-suf=" мес">0</div><div className="lbl">гарантия на работы</div></div>
      </div></div></div>

      {/* CALCULATOR */}
      <section className="blk"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">Сколько это стоит</span><h2>Рассчитайте примерную цену за 10 секунд</h2>
          <p>Честная вилка ещё до звонка. Точную цену мастер назовёт после бесплатной диагностики.</p></div>
        <PriceCalculator />
      </div></section>

      {/* КАК ОТБИРАЕМ МАСТЕРОВ — честные принципы без выдуманных персон */}
      <section className="blk how"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">Кто приедет</span><h2>Проверенные мастера, а не случайные люди</h2>
          <p>Отбираем исполнителей по чётким правилам — вы получаете специалиста с опытом, а не случайного человека по объявлению.</p></div>
        <div className="mast-grid stg">
          {[
            { ic: "M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z|M9 12l2 2 4-4", t: "Проверка документов", d: "Паспорт и опыт подтверждены до допуска к заявкам." },
            { ic: "M12 8v5l3 2|M12 22a10 10 0 100-20 10 10 0 000 20", t: "Профильный опыт", d: "Мастера с реальной практикой по нужному направлению." },
            { ic: "M20 6L9 17l-5-5", t: "Гарантия на работы", d: "На выполненный ремонт — гарантия до 12 месяцев." },
            { ic: "M2 7h20v12H2z|M2 11h20|M6 15h4", t: "Оплата после", d: "Сначала результат и чек — потом оплата, цена заранее." },
          ].map((m) => (
            <div className="mast" key={m.t} style={{ padding: 20 }}>
              <span className="fi" style={{ display: "inline-grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent-ink)", marginBottom: 12 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{m.ic.split("|").map((d, i) => <path key={i} d={d} />)}</svg>
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{m.t}</h3>
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>{m.d}</p>
            </div>
          ))}
        </div>
      </div></section>

      {/* SERVICES */}
      <section className="blk"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">Что чиним</span><h2>Популярные услуги</h2>
          <p>Цену фиксируем до начала работ — никаких «доплат по факту».</p></div>
        <div className="svc-grid stg">
          {popularServices.map((s) => (
            <Link className="svc" href={`/uslugi/${s.serviceSlug}`} key={s.serviceSlug}>
              <span
                className={PHOTO_SERVICES.has(s.serviceSlug) ? "svc-photo" : "svc-photo grad"}
                style={PHOTO_SERVICES.has(s.serviceSlug) ? { backgroundImage: `url(/images/promaster/${s.serviceSlug}.jpg)` } : undefined}
              >
                <span className="ic"><Ic slug={s.serviceSlug} /></span>
              </span>
              <h3>{s.service}</h3>
              <span className="price">{s.cityCount} городов</span>
              <span className="go">Выбрать город {ARR}</span>
            </Link>
          ))}
        </div>
      </div></section>

      {/* HOW */}
      <section className="blk how"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">Как это работает</span><h2>Три шага до починки</h2></div>
        <div className="steps stg">
          <div className="step"><div className="n">1</div><h3>Оставляете заявку</h3><p>Услуга, город, телефон — или просто звоните. Минута времени.</p></div>
          <div className="step"><div className="n">2</div><h3>Мастер перезванивает</h3><p>За 5 минут находим ближайшего специалиста, согласуем время и примерную цену.</p></div>
          <div className="step"><div className="n">3</div><h3>Приезжает и чинит</h3><p>Диагностика бесплатна, стоимость — до начала работ. На результат — гарантия до 12 месяцев.</p></div>
        </div>
      </div></section>

      {/* GUARANTEE */}
      <section className="blk"><div className="wrap"><div className="guar2 rv">
        <div className="guar2-bggrid" aria-hidden /><div className="guar2-glow" aria-hidden />
        <div className="guar2-head"><span className="eyebrow" style={{ color: "var(--accent-2)" }}>Спокойно и по-честному</span>
          <h2>Отвечаем за результат<br />— не на словах</h2>
          <p>Работаем официально и берём ответственность за каждую выполненную работу.</p></div>
        <div className="guar2-cards stg">
          <div className="gcard2 gcard2-hl"><span className="gc-badge">12 мес</span>
            <span className="gc-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V5z" /><path d="M9 12l2 2 4-4" /></svg></span>
            <h3>Гарантия до 12 месяцев</h3><p>Если после ремонта проблема вернулась в гарантийный срок — приедем и устраним бесплатно.</p></div>
          <div className="gcard2"><span className="gc-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></svg></span>
            <h3>Договор и чек</h3><p>Официально, по договору, с чеком. Мастеров проверяем — не «человек из объявления».</p></div>
          <div className="gcard2"><span className="gc-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></span>
            <h3>Оплата после работ</h3><p>Никакой предоплаты. Платите, только когда всё сделано и вы приняли работу.</p></div>
        </div>
      </div></div></section>

      {/* GALLERY */}
      <section className="blk how"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">Наши работы</span><h2>Как мы работаем</h2>
          <p>Реальные примеры выездов — от замены смесителя до ремонта проводки.</p></div>
        <div className="gal stg">
          {WORKS.map((w) => (
            <div className="gcard" key={w.t}>
              <div className="gphoto" style={{ backgroundImage: `url(/images/promaster/${w.img}.jpg)` }}><span className="tag">Выполнено</span></div>
              <div className="cap">{w.t}<span>{w.c}</span></div>
            </div>
          ))}
        </div>
      </div></section>

      {/* Отзывы намеренно не выводим: реальных пока нет, выдуманные — риск
          санкций Яндекса/Google. Появятся из Яндекс.Бизнеса. */}

      {/* FAQ */}
      <section className="blk how"><div className="wrap">
        <div className="faq2 rv">
          <div className="faq2-side"><span className="eyebrow">Вопросы и ответы</span><h2>Отвечаем честно</h2>
            <p>Собрали то, что спрашивают чаще всего. Не нашли свой вопрос — позвоните, подскажем бесплатно.</p>
            <a className="btn btn-accent" href={DEFAULT_PHONE.href} style={{ marginTop: 6 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.7 2z" /></svg>Позвонить</a>
          </div>
          <div className="faq2-list">
            {FAQS.map(([q, a], i) => (
              <details className="qa" key={q} open={i === 0}>
                <summary>{q}<span className="qi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span></summary>
                <div className="ans">{a}</div>
              </details>
            ))}
          </div>
        </div>
      </div></section>

      {/* CITIES */}
      <section className="blk"><div className="wrap">
        <div className="sec-head rv"><span className="eyebrow">География</span><h2>Работаем в вашем городе</h2>
          <p>{cities.length} городов России. Найдите свой — покажем услуги и мастеров рядом.</p></div>
        <div className="cities2 rv">
          <label className="city-search">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input type="text" id="pm-city-search" placeholder="Введите название вашего города" autoComplete="off" />
          </label>
          <div className="city-grid">
            {cities.slice(0, 24).map((c) => (
              <Link className="ccard" href={`/goroda/${c.citySlug}`} key={c.citySlug} data-city={c.city}>
                <span><b>{c.city}</b><small>Мастера рядом · 24/7</small></span>
                <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
        </div>
      </div></section>

      {/* BAND */}
      <section className="blk" style={{ paddingTop: 6 }}><div className="wrap"><div className="band rv">
        <div className="deco" aria-hidden />
        <span className="eyebrow" style={{ color: "var(--accent-2)" }}>Нужен мастер прямо сейчас?</span>
        <h2 style={{ marginTop: 12 }}>Позвоните — и мастер выедет в течение 30 минут</h2>
        <p>Круглосуточно, без выходных. Диагностика бесплатно, оплата после выполнения работ.</p>
        <a className="btn btn-accent" href={DEFAULT_PHONE.href}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.7 2z" /></svg>{DEFAULT_PHONE.display}</a>
      </div></div></section>
    </main>
  );
}
