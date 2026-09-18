import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import { COMPANY } from "@/lib/company";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Гарантия на работы мастера — до 12 месяцев | ПроМастер",
  description:
    "Гарантия ПроМастер до 12 месяцев на выполненные работы и установленные детали. Если поломка вернулась в гарантийный срок — приедем и устраним бесплатно. Как оформляется гарантия.",
  alternates: { canonical: "/garantii" },
};

const POINTS = [
  ["На что распространяется", "Гарантия действует на выполненные работы и установленные мастером детали. Срок — от 6 до 12 месяцев в зависимости от вида услуги и запчасти."],
  ["Что делать при повторной поломке", "Если в гарантийный срок проблема вернулась по той же причине — сообщите нам. Мастер приедет повторно и устранит её бесплатно."],
  ["Как оформляется", "Гарантия фиксируется в документах на работу (договор/квитанция). Сохраните их — этого достаточно для гарантийного обращения."],
  ["Когда гарантия не действует", "На повреждения из-за неправильной эксплуатации, вмешательства других лиц после ремонта или естественного износа расходных материалов сверх заявленного срока."],
];

export default function WarrantyPage() {
  return (
    <main>
      <SiteScripts />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Гарантии" }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">Гарантия</span>
          <h1>Гарантия до 12 месяцев</h1>
          <p>Мы отвечаем за результат: если проблема вернулась в гарантийный срок — устраним бесплатно.</p>
        </div>

        <div className="two-col rv">
          {POINTS.map(([t, d]) => (
            <div className="info-card" key={t}>
              <h3>{t}</h3>
              <p style={{ color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>{d}</p>
            </div>
          ))}
        </div>

        <div className="band rv" style={{ marginTop: 30 }}>
          <div className="deco" aria-hidden />
          <span className="eyebrow" style={{ color: "var(--accent-2)" }}>Спокойно и по-честному</span>
          <h2 style={{ marginTop: 12 }}>Гарантия — не на словах</h2>
          <p>Оставьте заявку — мастер приедет, назовёт цену до начала работ и оформит гарантию на результат.</p>
          <a className="btn btn-accent" href={COMPANY.phone.href}>{COMPANY.phone.display}</a>
        </div>
      </div></section>
    </main>
  );
}
