import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import { getAllServices } from "@/lib/catalog";
import { COMPANY } from "@/lib/company";
import { PHOTO_SERVICES, Ic } from "@/lib/service-icons";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Все услуги мастеров на дом — каталог | ПроМастер",
  description:
    "Полный каталог бытовых услуг ПроМастер: сантехник, электрик, ремонт стиральных машин, холодильников, кондиционеров и другой техники. Выберите услугу и город.",
  alternates: { canonical: "/uslugi" },
};

export default function ServicesHubPage() {
  const services = getAllServices();

  return (
    <main>
      <SiteScripts />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Услуги" }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">Каталог</span>
          <h1>Услуги мастеров на дом</h1>
          <p>Выберите нужную услугу — покажем мастеров и цены в вашем городе. Работаем в {COMPANY.citiesCount} городах России, выезд от 30 минут.</p>
        </div>
        <div className="svc-grid stg">
          {services.map((s) => (
            <Link className="svc" href={`/uslugi/${s.serviceSlug}`} key={s.serviceSlug}>
              <span
                className={PHOTO_SERVICES.has(s.serviceSlug) ? "svc-photo" : "svc-photo grad"}
                style={PHOTO_SERVICES.has(s.serviceSlug) ? { backgroundImage: `url(/images/promaster/${s.serviceSlug}.jpg)` } : undefined}
              >
                <span className="ic"><Ic slug={s.serviceSlug} size={26} /></span>
              </span>
              <h3>{s.service}</h3>
              <span className="price">{s.cityCount} городов</span>
              <span className="go">Выбрать город <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
            </Link>
          ))}
        </div>
      </div></section>
    </main>
  );
}
