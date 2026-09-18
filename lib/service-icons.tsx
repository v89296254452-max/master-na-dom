import type { ReactNode } from "react";

/**
 * Единый набор иконок услуг + список услуг с реальным фото.
 * Используется на главной, хабе /uslugi и карточках услуг, чтобы иконки
 * и фото были консистентны везде (раньше набор дублировался и был неполным —
 * все услуги кроме сантехника/электрика показывали одну «отвёртку»).
 */

// Услуги, для которых есть реальное фото-герой в /public/images/promaster/<slug>.jpg
// (и галерея работ в /work/<slug>-1..6.*). Реальные фото работ с объектов.
export const PHOTO_SERVICES = new Set<string>([
  "santehnik",
  "elektrik",
  "master-na-chas",
  "remont-stiralnyh-mashin",
  "remont-holodilnikov",
  "remont-kondicionerov",
  "remont-televizorov",
  "remont-duhovyh-shkafov",
  "remont-varochnyh-panelej",
  "remont-vodonagrevatelej",
  "remont-kofemashin",
  "remont-pmm",
  "remont-okon",
  "kp",
  "dezinfekciya",
  "klining",
  "sborka-mebeli",
]);

// Услуги, у которых есть галерея реальных работ (work/<slug>-1..6.*).
// Совпадает с PHOTO_SERVICES.
export const WORK_GALLERY_SERVICES = PHOTO_SERVICES;
export const WORK_GALLERY_COUNT = 6;

export const SVC_ICON: Record<string, ReactNode> = {
  santehnik: <path d="M12 3c4.4 4.8 6 8 6 11.1a6 6 0 11-12 0C6 11 7.6 7.8 12 3z" />,
  elektrik: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  "remont-holodilnikov": <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M6 10h12M9 5v2M9 13v3" /></>,
  "remont-stiralnyh-mashin": <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4" /><path d="M7 6h.01M10 6h.01" /></>,
  "remont-pmm": <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 7h16" /><circle cx="12" cy="14" r="3.5" /></>,
  "remont-kondicionerov": <><rect x="3" y="4" width="18" height="7" rx="2" /><path d="M6 8h9M7 15c0 1.5 1 2 1 3M12 15c0 1.5 1 2 1 3M17 15c0 1.5 1 2 1 3" /></>,
  "remont-televizorov": <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  "remont-duhovyh-shkafov": <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 8h16M8 5.5h.01M11 5.5h.01M8 12h8" /></>,
  "remont-varochnyh-panelej": <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="2" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /><circle cx="16" cy="16" r="2" /></>,
  "remont-vodonagrevatelej": <><rect x="6" y="2" width="12" height="16" rx="3" /><path d="M9 22c0-1.5 1.5-2 1.5-3.5M14 22c0-1.5 1.5-2 1.5-3.5M10 6h4" /></>,
  "remont-kofemashin": <><path d="M4 8h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5z" /><path d="M17 9h2a2 2 0 010 4h-2M8 3v2M11 3v2" /></>,
  kp: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M9 16l-.5 4M15 16l.5 4" /></>,
  "remont-okon": <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M12 3v18M4 12h16" /></>,
  dezinfekciya: <><path d="M10 2h4v3h-4z" /><path d="M8 5h8l1.5 4v12H6.5V9z" /><path d="M19 7h2M19 10h2M19 13h2" /></>,
  klining: <><path d="M7 3l3 6M4 9h12l-1.5 12h-9z" /><path d="M8 13v4M12 13v4" /></>,
  "sborka-mebeli": <><rect x="3" y="5" width="18" height="9" rx="1.5" /><path d="M5 14v5M19 14v5M3 9h18" /></>,
  "master-na-chas": <path d="M14.7 6.3a4 4 0 01-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 015.4-5.4l-2.7 2.7-2-2 2.7-2.7z" />,
  default: <path d="M14.7 6.3a4 4 0 01-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 015.4-5.4l-2.7 2.7-2-2 2.7-2.7z" />,
};

export function Ic({ slug, size = 24 }: { slug: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {SVC_ICON[slug] ?? SVC_ICON.default}
    </svg>
  );
}
