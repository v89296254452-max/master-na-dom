import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import { COMPANY } from "@/lib/company";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Как мы работаем — вызов мастера на дом | ПроМастер",
  description:
    "Как устроен вызов мастера через ПроМастер: оставляете заявку, мастер перезванивает за 5 минут, приезжает, диагностика бесплатно, оплата после работ. Проверяем каждого мастера.",
  alternates: { canonical: "/kak-rabotaem" },
};

const STEPS = [
  ["1", "Оставляете заявку", "Услуга, город и телефон — или просто звоните. Занимает меньше минуты."],
  ["2", "Мастер перезванивает за 5 минут", "Диспетчер подбирает ближайшего профильного специалиста, согласует удобное время и ориентировочную стоимость."],
  ["3", "Приезжает и проводит диагностику", "Выезд в среднем за 30 минут. Диагностика бесплатна при выполнении работ. Мастер называет точную цену до начала."],
  ["4", "Выполняет работу и вы её принимаете", "Оплата только после того, как всё сделано и вы приняли результат. На работы — гарантия до 12 месяцев."],
];

const VET = [
  "Проверяем паспорт и документы",
  "Оцениваем опыт и профильную специализацию",
  "Работаем по договору, с чеком",
  "Отслеживаем качество по обратной связи клиентов",
];

export default function HowWeWorkPage() {
  return (
    <main>
      <SiteScripts />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Как мы работаем" }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">Процесс</span>
          <h1>Как мы работаем</h1>
          <p>Прозрачно и без предоплат: от заявки до принятой работы — четыре простых шага.</p>
        </div>

        <div className="steps stg">
          {STEPS.map(([n, t, d]) => (
            <div className="step" key={n}><div className="n">{n}</div><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>

        <div className="seo-wrap rv" style={{ marginTop: 34 }}>
          <div className="seotext">
            <h2>Каких мастеров мы отправляем</h2>
            <p>ПроМастер — сервис-агрегатор: мы связываем вас с проверенными частными мастерами и бригадами в вашем городе. К вам приезжает профильный специалист именно по нужной услуге, а не «человек из объявления».</p>
            <ul className="ps-trust">
              {VET.map((v) => (
                <li key={v}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>{v}</li>
              ))}
            </ul>
            <p>Работаем в {COMPANY.citiesCount} городах России круглосуточно. Если что-то пойдёт не так в гарантийный срок — приедем и устраним бесплатно.</p>
          </div>
          <aside className="seo-facts">
            <div className="sf-body">
              <h3>Коротко</h3>
              <ul>
                <li>Выезд <b>за 30 минут</b></li>
                <li>Диагностика <b>бесплатно</b></li>
                <li>Оплата <b>после работ</b></li>
                <li>Гарантия <b>до 12 мес.</b></li>
                <li>Работаем <b>24/7</b></li>
              </ul>
              <a className="btn btn-accent" href={COMPANY.phone.href} style={{ width: "100%", marginTop: 14, justifyContent: "center" }}>Вызвать мастера</a>
            </div>
          </aside>
        </div>
      </div></section>
    </main>
  );
}
