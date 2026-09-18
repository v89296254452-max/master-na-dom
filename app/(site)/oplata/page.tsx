import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import { COMPANY } from "@/lib/company";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Оплата — только после выполнения работ | ПроМастер",
  description:
    "Как оплатить вызов мастера ПроМастер: без предоплаты, оплата после приёмки работ. Наличными или переводом/картой. Диагностика бесплатна при ремонте, чек по запросу.",
  alternates: { canonical: "/oplata" },
};

const POINTS = [
  ["Без предоплаты", "Вы платите только после того, как работа выполнена и вы её приняли. Никаких переводов «за выезд» заранее."],
  ["Диагностика бесплатно", "При выполнении ремонта диагностика не оплачивается. Стоимость работы мастер называет до начала — и фиксирует её."],
  ["Удобный способ оплаты", "Наличными мастеру или переводом / картой — как вам удобнее. Уточните способ у диспетчера при заявке."],
  ["Честная цена без доплат", "Согласованная до начала работ сумма не меняется по ходу. «Доплат по факту» не будет."],
];

export default function PaymentPage() {
  return (
    <main>
      <SiteScripts />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Оплата" }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">Оплата</span>
          <h1>Оплата после работ</h1>
          <p>Прозрачно и без риска: сначала мастер делает — потом вы оплачиваете.</p>
        </div>

        <div className="two-col rv">
          {POINTS.map(([t, d]) => (
            <div className="info-card" key={t}>
              <h3>{t}</h3>
              <p style={{ color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>{d}</p>
            </div>
          ))}
        </div>

        <div className="sec-head rv" style={{ marginTop: 40 }}>
          <span className="eyebrow">Документы</span>
          <h2>Что вы получаете после ремонта</h2>
          <p>Прозрачная сделка: все работы фиксируются документально, никаких устных договорённостей.</p>
        </div>
        <div className="two-col rv">
          {[
            { t: "Договор / квитанция на услуги", d: "Перечень работ, стоимость и сроки фиксируются письменно до начала — вы точно знаете, за что платите." },
            { t: "Гарантийный талон", d: "На выполненные работы и установленные запчасти — до 12 месяцев. С талоном повторный вызов по гарантии бесплатен." },
            { t: "Кассовый чек", d: "Официальный чек об оплате выдаётся по запросу — для отчётности или подтверждения расходов." },
            { t: "Ответственность мастера", d: "Мастер несёт материальную ответственность за качество работ. Спорные ситуации решаем в вашу пользу в рамках гарантии." },
          ].map((x) => (
            <div className="info-card" key={x.t}>
              <h3>{x.t}</h3>
              <p>{x.d}</p>
            </div>
          ))}
        </div>

        <div className="band rv" style={{ marginTop: 30 }}>
          <div className="deco" aria-hidden />
          <span className="eyebrow" style={{ color: "var(--accent-2)" }}>Никакой предоплаты</span>
          <h2 style={{ marginTop: 12 }}>Платите за результат</h2>
          <p>Вызовите мастера — цену узнаете до начала работ, оплатите после приёмки.</p>
          <a className="btn btn-accent" href={COMPANY.phone.href}>{COMPANY.phone.display}</a>
        </div>
      </div></section>
    </main>
  );
}
