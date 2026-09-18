import Link from "next/link";
import { DEFAULT_PHONE } from "@/lib/phones";

const BRAND_PHONE = DEFAULT_PHONE.display;
const BRAND_PHONE_HREF = DEFAULT_PHONE.href;

const LogoMark = () => (
  <span className="pm-logo" aria-hidden>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" />
    </svg>
  </span>
);

export default function Header() {
  return (
    <>
      <div id="pm-prog" />
      <div className="announce">
        <div className="wrap">
          <span className="dot" />
          Срочный вызов — мастер выедет за 30 минут · Работаем 24/7 по всей России
        </div>
      </div>
      <header id="pm-hdr">
        <div className="wrap nav">
          <Link href="/" className="brand" aria-label="ПроМастер — на главную">
            <LogoMark />
            ПроМастер
          </Link>
          <nav className="navlinks">
            <Link className="hidem" href="/uslugi">Услуги</Link>
            <Link className="hidem" href="/goroda">Города</Link>
            <Link className="hidem" href="/blog">Блог</Link>
            <a className="phone-top hidem js-phone" href={BRAND_PHONE_HREF}>{BRAND_PHONE}</a>
            <Link className="btn btn-accent hidem" style={{ padding: "10px 18px", fontSize: 14 }} href="#lead-form">
              Вызвать мастера
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
