"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_PHONE } from "@/lib/phones";

/**
 * Мобильная навигация: бургер-меню (drawer) + липкая нижняя панель со звонком.
 * Видны только на мобайле (≤900px, класс .only-m). На десктопе не отображаются.
 * Телефон помечен .js-phone — SiteScripts подставляет номер направления
 * (коллтрекинг) на страницах услуг через #pm-page-phone.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);

  // блокируем скролл body, пока открыт drawer
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="burger only-m"
        aria-label="Меню"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span /><span /><span />
      </button>

      <div className={`mdrawer${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <div className="mdrawer-back" onClick={() => setOpen(false)} />
        <nav className="mdrawer-panel">
          <div className="mdrawer-top">
            <span className="mdrawer-ttl">Меню</span>
            <button type="button" className="mdrawer-x" aria-label="Закрыть" onClick={() => setOpen(false)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <Link href="/uslugi" onClick={() => setOpen(false)}>Все услуги</Link>
          <Link href="/goroda" onClick={() => setOpen(false)}>Города</Link>
          <Link href="/blog" onClick={() => setOpen(false)}>Блог</Link>
          <a className="js-phone mdrawer-phone" href={DEFAULT_PHONE.href}>{DEFAULT_PHONE.display}</a>
          <Link className="btn btn-accent" href="#lead-form" onClick={() => setOpen(false)}>Вызвать мастера</Link>
        </nav>
      </div>

      {/* Липкая нижняя панель — главный конверсионный элемент на мобайле */}
      <div className="mcallbar only-m">
        <a className="js-phone-href mcallbar-call" href={DEFAULT_PHONE.href}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.7 2z" /></svg>
          Позвонить
        </a>
        <a className="btn btn-accent mcallbar-cta" href="#lead-form">Вызвать мастера</a>
      </div>
    </>
  );
}
