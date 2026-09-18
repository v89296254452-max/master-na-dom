import type { CSSProperties } from "react";

/**
 * Серверный inline-style фона hero-секции (LCP-элемент). Раньше фон ставился
 * JS'ом (SiteScripts) — браузер не мог нарисовать hero до выполнения скрипта,
 * что убивало LCP на мобильных. Теперь фон в SSR-HTML: gradient + image-set
 * (avif→webp→jpg). Плюс отдельный preload avif в компоненте для приоритета.
 */
const GRAD =
  "linear-gradient(100deg,rgba(10,20,33,.92) 0%,rgba(10,20,33,.62) 52%,rgba(10,20,33,.24) 100%)";

export function heroBgStyle(heroPhotoJpg: string): CSSProperties {
  const base = heroPhotoJpg.replace(/\.jpg$/, "");
  const img =
    base !== heroPhotoJpg
      ? `image-set(url("${base}.avif") type("image/avif"), url("${base}.webp") type("image/webp"), url("${heroPhotoJpg}") type("image/jpeg"))`
      : `url("${heroPhotoJpg}")`;
  return { backgroundImage: `${GRAD},${img}` };
}
