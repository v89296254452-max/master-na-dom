/**
 * SVG-спрайт часто повторяющихся иконок.
 *
 * На гео-странице было 92 инлайн-<svg> при 25 уникальных: одна стрелка
 * повторялась 29 раз, галочка — 18 (≈20 КБ HTML). Теперь контур описан один раз
 * в <symbol>, а места использования ссылаются через <use> (~60 байт вместо ~200).
 * Спрайт рендерится в начале <body>, скрытый и недоступный для скринридеров.
 */
export const ICONS = {
  check: "M20 6L9 17l-5-5",
  arr: "M5 12h14M13 6l6 6-6 6",
  pin: "M12 21s-7-6.3-7-11a7 7 0 0114 0c0 4.7-7 11-7 11z",
  warn: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
} as const;

export type IconName = keyof typeof ICONS;

/** Ссылка на иконку из спрайта. Размер/цвет — через props/CSS, как у инлайна. */
export function Icon({ name, size = 17, className }: { name: IconName; size?: number; className?: string }) {
  // Презентационные атрибуты (fill/stroke/linecap/...) вынесены в CSS-класс .ic —
  // они повторялись ~150 байт на каждую из 92 иконок. Через класс — ~10 байт.
  return (
    <svg width={size} height={size} className={className ? `ic ${className}` : "ic"} aria-hidden>
      <use href={`#i-${name}`} />
    </svg>
  );
}

/** Определения символов. Рендерить ОДИН раз на страницу. */
export default function SvgSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        {(Object.keys(ICONS) as IconName[]).map((k) => (
          <symbol key={k} id={`i-${k}`} viewBox="0 0 24 24">
            {ICONS[k].split("|").map((d, i) => (
              <path key={i} d={d} />
            ))}
          </symbol>
        ))}
        <symbol id="i-pin-dot" viewBox="0 0 24 24">
          <path d={ICONS.pin} />
          <circle cx="12" cy="10" r="2.5" />
        </symbol>
      </defs>
    </svg>
  );
}
