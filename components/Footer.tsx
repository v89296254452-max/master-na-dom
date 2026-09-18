import Link from "next/link";
import { getAllServices, getAllCities } from "@/lib/catalog";
import { DEFAULT_PHONE } from "@/lib/phones";
import { COMPANY, companySocials } from "@/lib/company";

const BRAND_PHONE = DEFAULT_PHONE.display;
const BRAND_PHONE_HREF = DEFAULT_PHONE.href;
const CONTACT_EMAIL = "info@master-na-dom.online";

export default function Footer() {
  const topServices = getAllServices().slice(0, 6);
  const topCities = getAllCities().slice(0, 8);
  const socials = companySocials();

  return (
    <footer>
      <div className="wrap fgrid">
        <div>
          <div className="brand" style={{ fontSize: 17 }}>
            <span className="pm-logo" style={{ width: 32, height: 32 }} aria-hidden>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" />
              </svg>
            </span>
            ПроМастер
          </div>
          <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 14, maxWidth: "34ch" }}>
            Вызов проверенного мастера на дом в {COMPANY.citiesCount} городах России. Выезд от 30 минут, честные цены, гарантия.
          </p>
          <a className="js-phone" href={BRAND_PHONE_HREF} style={{ display: "inline-block", marginTop: 14, fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>
            {BRAND_PHONE}
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ display: "block", marginTop: 4, fontSize: 14, color: "var(--muted)" }}>
            {CONTACT_EMAIL}
          </a>
        </div>

        <nav aria-label="Услуги">
          <h4>Услуги</h4>
          {topServices.map((s) => (
            <Link key={s.serviceSlug} href={`/uslugi/${s.serviceSlug}`}>{s.service}</Link>
          ))}
          <Link href="/uslugi" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>Все услуги →</Link>
        </nav>

        <nav aria-label="Города">
          <h4>Города</h4>
          {topCities.map((c) => (
            <Link key={c.citySlug} href={`/goroda/${c.citySlug}`}>{c.city}</Link>
          ))}
          <Link href="/goroda" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>Все города →</Link>
        </nav>

        <nav aria-label="Компания">
          <h4>Компания</h4>
          <Link href="/o-kompanii">О компании</Link>
          <Link href="/kak-rabotaem">Как мы работаем</Link>
          <Link href="/garantii">Гарантии</Link>
          <Link href="/oplata">Оплата</Link>
          <Link href="/kontakty">Контакты</Link>
          <Link href="/blog">Блог</Link>
          <Link href="/problem">Частые проблемы</Link>
          <Link href="/politika-konfidencialnosti">Политика конфиденциальности</Link>
          <Link href="/polzovatelskoe-soglashenie">Пользовательское соглашение</Link>
          {socials.length > 0 && (
            <span style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {socials.map((s) => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener" style={{ fontWeight: 700 }}>{s.label}</a>
              ))}
            </span>
          )}
        </nav>
      </div>
      <div className="wrap fbot">
        <div style={{ marginBottom: 8, lineHeight: 1.6 }}>
          ИП Решетникова Валерия Георгиевна · ИНН 032631244812 · ОГРНИП 323030000004422 · г. Улан-Удэ
        </div>
        © 2026 ПроМастер — сервис вызова мастеров на дом. Информация на сайте не является публичной офертой. Стоимость работ определяется мастером после диагностики.
      </div>
    </footer>
  );
}
