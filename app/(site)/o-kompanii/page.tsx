import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import { COMPANY } from "@/lib/company";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "О компании ПроМастер — вызов мастера на дом по России",
  description:
    `ПроМастер — сервис вызова проверенных мастеров на дом в ${COMPANY.citiesCount} городах России: сантехники, электрики, ремонт бытовой техники. Работаем официально, с гарантией и оплатой после работ.`,
  alternates: { canonical: "/o-kompanii" },
};

const STATS = [
  [String(COMPANY.yearsOnMarket) + " лет", "на рынке бытовых услуг"],
  [COMPANY.clients, "выполненных заявок"],
  [String(COMPANY.citiesCount), "городов России"],
  ["24/7", "работаем круглосуточно"],
];

export default function AboutPage() {
  return (
    <main>
      <SiteScripts />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "О компании" }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">О компании</span>
          <h1>О сервисе ПроМастер</h1>
          <p>Помогаем быстро найти проверенного мастера на дом — без поиска по объявлениям и без риска нарваться на непрофессионала.</p>
        </div>

        <div className="proof" style={{ borderRadius: "var(--radius)", overflow: "hidden" }}><div className="wrap" style={{ padding: 0 }}>
          <div className="proof-grid rv">
            {STATS.map(([n, l]) => (
              <div key={l}><div className="num">{n}</div><div className="lbl">{l}</div></div>
            ))}
          </div>
        </div></div>

        <div className="seo-wrap rv" style={{ marginTop: 34 }}>
          <div className="seotext">
            <h2>Что мы делаем</h2>
            <p>ПроМастер — сервис-агрегатор вызова мастеров на дом. Мы связываем клиентов с проверенными частными специалистами и бригадами по всей России: сантехники, электрики, мастера по ремонту бытовой техники, окон, а также «муж на час».</p>
            <p>Вы оставляете заявку — мы за 5 минут подбираем ближайшего профильного мастера, согласуем время и ориентировочную цену. Диагностика бесплатна при выполнении работ, стоимость известна до начала, оплата — после приёмки. На результат даём гарантию до 12 месяцев.</p>
            <h2>Почему нам доверяют</h2>
            <p>Каждого мастера проверяем: документы, опыт, профильную специализацию. Работаем официально — по договору, с чеком. Не навязываем лишние услуги: мастер объясняет причину поломки простым языком и предлагает варианты решения.</p>
            <p>Подробнее — на страницах <Link href="/kak-rabotaem">Как мы работаем</Link>, <Link href="/garantii">Гарантии</Link> и <Link href="/oplata">Оплата</Link>.</p>
          </div>
          <aside className="seo-facts">
            <div className="sf-body">
              <h3>Реквизиты</h3>
              <ul>
                {COMPANY.legalName && <li>{COMPANY.legalName}</li>}
                {COMPANY.inn && <li>ИНН <b>{COMPANY.inn}</b></li>}
                {COMPANY.ogrn && <li>ОГРН <b>{COMPANY.ogrn}</b></li>}
                <li>Email <b>{COMPANY.email}</b></li>
                <li>Телефон <b>{COMPANY.phone.display}</b></li>
              </ul>
              <Link className="btn btn-accent" href="/kontakty" style={{ width: "100%", marginTop: 14, justifyContent: "center" }}>Контакты</Link>
            </div>
          </aside>
        </div>
      </div></section>
    </main>
  );
}
