"use client";

import { useState } from "react";

/**
 * Фасад Яндекс.Карты: тяжёлый map-widget (сотни КБ JS) грузится ТОЛЬКО по клику,
 * а не на каждой загрузке страницы. До клика — лёгкая статичная заглушка.
 * Экономит краул-бюджет/вес и ускоряет страницу (карта — SEO-нейтральный блок).
 */
export default function MapFacade({ city, title }: { city: string; title: string }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <iframe
        src={`https://yandex.ru/map-widget/v1/?mode=search&text=${encodeURIComponent(city + ", Россия")}&z=11`}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    );
  }
  return (
    <button type="button" className="map-facade" onClick={() => setOpen(true)} aria-label={`Показать карту: ${title}`}>
      <span className="map-facade__pin">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.3-7-11a7 7 0 0114 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <span className="map-facade__label">Показать карту зоны выезда в {city}</span>
    </button>
  );
}
