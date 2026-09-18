"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "pm_cookie_consent";

/**
 * Плашка согласия на cookie/аналитику (152-ФЗ + требования РКН при
 * установленной Яндекс.Метрике). Показывается один раз, выбор хранится
 * в localStorage. Без внешних зависимостей, обе темы через токены сайта.
 */
export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* приватный режим — не показываем, не падаем */
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-label="Использование cookie">
      <p className="cookie-consent__text">
        Мы используем cookie и Яндекс.Метрику. Продолжая, вы соглашаетесь с{" "}
        <Link href="/politika-konfidencialnosti">политикой конфиденциальности</Link>.
      </p>
      <button type="button" className="cookie-consent__btn" onClick={accept}>
        Принять
      </button>
    </div>
  );
}
