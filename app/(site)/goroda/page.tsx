import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import { getAllCities } from "@/lib/catalog";
import { COMPANY } from "@/lib/company";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Города — вызов мастера на дом в вашем городе | ПроМастер",
  description:
    `ПроМастер работает в ${COMPANY.citiesCount} городах России. Выберите свой город — покажем доступные услуги мастеров: сантехник, электрик, ремонт техники, и вызовем специалиста.`,
  alternates: { canonical: "/goroda" },
};

export default function CitiesHubPage() {
  const cities = getAllCities();

  return (
    <main>
      <SiteScripts />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Города" }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">География</span>
          <h1>Города обслуживания</h1>
          <p>Мы работаем в {cities.length} городах России. Найдите свой — покажем услуги и вызовем мастера.</p>
        </div>
        <div className="cities2 rv">
          <label className="city-search">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input type="text" id="pm-city-search" placeholder="Введите название вашего города" autoComplete="off" />
          </label>
          <div className="city-grid">
            {cities.map((c) => (
              <Link className="ccard" href={`/goroda/${c.citySlug}`} key={c.citySlug} data-city={c.city}>
                <span><b>{c.city}</b><small>{c.serviceCount} услуг · 24/7</small></span>
                <svg className="arr" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
        </div>
      </div></section>
    </main>
  );
}
