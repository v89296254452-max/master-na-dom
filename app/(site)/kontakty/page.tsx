import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import SiteScripts from "@/components/promaster/SiteScripts";
import JsonLdScripts from "@/components/service/JsonLdScripts";
import { buildOrganizationJsonLd } from "@/lib/seo/schema";
import { COMPANY, companySocials } from "@/lib/company";
import { getSiteUrl } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Контакты ПроМастер — телефон, email, реквизиты",
  description:
    `Контакты сервиса вызова мастера на дом ПроМастер: телефон, email, режим работы, реквизиты. Вызов мастера круглосуточно в ${COMPANY.citiesCount} городах России.`,
  alternates: { canonical: "/kontakty" },
};

export default function ContactsPage() {
  const socials = companySocials();
  const org = buildOrganizationJsonLd();
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: `${getSiteUrl()}/kontakty`,
    name: `Контакты — ${COMPANY.brand}`,
  };

  return (
    <main>
      <SiteScripts />
      <JsonLdScripts schemas={[org, contactSchema]} />
      <section className="blk"><div className="wrap">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Контакты" }]} />
        <div className="sec-head rv" style={{ marginTop: 6 }}>
          <span className="eyebrow">Контакты</span>
          <h1>Связаться с ПроМастер</h1>
          <p>Вызвать мастера, задать вопрос или уточнить статус заявки — мы на связи круглосуточно.</p>
        </div>

        <div className="two-col rv">
          <div className="info-card">
            <h3>Телефон и заявки</h3>
            <p style={{ marginTop: 10 }}>
              <a className="js-phone" href={COMPANY.phone.href} style={{ fontSize: 24, fontWeight: 800, color: "var(--steel)" }}>{COMPANY.phone.display}</a>
            </p>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>Приём заявок: <b>{COMPANY.hours}</b></p>
            <p style={{ color: "var(--muted)", marginTop: 4 }}>Email: <a href={`mailto:${COMPANY.email}`} style={{ color: "var(--steel)" }}>{COMPANY.email}</a></p>
            {socials.length > 0 && (
              <p style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap" }}>
                {socials.map((s) => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener" style={{ color: "var(--steel)", fontWeight: 700 }}>{s.label}</a>
                ))}
              </p>
            )}
            <a className="btn btn-accent" href={COMPANY.phone.href} style={{ marginTop: 16 }}>Позвонить</a>
          </div>

          <div className="info-card">
            <h3>Реквизиты</h3>
            <ul className="ps-trust" style={{ marginTop: 10 }}>
              {COMPANY.legalName && <li>{COMPANY.legalName}</li>}
              {COMPANY.inn && <li>ИНН: {COMPANY.inn}</li>}
              {COMPANY.ogrn && <li>ОГРН/ОГРНИП: {COMPANY.ogrn}</li>}
              {COMPANY.address && <li>Адрес: {COMPANY.address}</li>}
              <li>Сайт: {COMPANY.domain}</li>
            </ul>
            {!COMPANY.legalName && !COMPANY.inn && (
              <p style={{ color: "var(--faint)", marginTop: 10, fontSize: 13 }}>Реквизиты предоставляются по запросу и указываются в договоре на выполнение работ.</p>
            )}
            <p style={{ color: "var(--muted)", marginTop: 12, lineHeight: 1.6 }}>Работаем в {COMPANY.citiesCount} городах России. Мастер выезжает по вашему адресу — офисного приёма нет, все заявки принимаем по телефону и через сайт.</p>
          </div>
        </div>
      </div></section>
    </main>
  );
}
