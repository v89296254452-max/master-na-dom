"use client";

import { useState } from "react";
import type { PageVisual } from "@/lib/images";

interface VisualImageProps {
  visual: PageVisual;
  variant?: "hero" | "gallery" | "detail";
  priority?: boolean;
  sizes?: string;
  className?: string;
}

function Placeholder({
  visual,
  variant,
}: {
  visual: PageVisual;
  variant: "hero" | "gallery" | "detail";
}) {
  const { meta } = visual;
  const isHero = variant === "hero";
  const isDetail = variant === "detail";

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden p-3 text-center text-white"
      style={{
        background: `linear-gradient(135deg, ${meta.gradientFrom} 0%, ${meta.gradientTo} 100%)`,
      }}
      role="img"
      aria-label={visual.alt}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${meta.accent}, transparent 55%)`,
        }}
      />
      <div
        className={`relative z-10 flex flex-col items-center ${isHero ? "gap-3" : isDetail ? "gap-1" : "gap-2"}`}
      >
        <span className={isHero ? "text-5xl" : isDetail ? "text-2xl" : "text-3xl"} aria-hidden>
          {meta.icon}
        </span>
        <span
          className={`font-bold leading-tight drop-shadow-sm ${
            isHero
              ? "text-lg sm:text-xl"
              : isDetail
                ? "text-xs sm:text-sm"
                : "text-sm sm:text-base"
          }`}
        >
          {meta.label}
        </span>
        {!isDetail && (
          <span className={`text-white/80 ${isHero ? "text-xs sm:text-sm" : "text-xs"}`}>
            ПроМастер
          </span>
        )}
      </div>
    </div>
  );
}

/** Без next/image: native img с fallback на CSS-placeholder */
export default function VisualImage({
  visual,
  variant = "gallery",
  priority = false,
  className = "object-cover",
}: VisualImageProps) {
  const [failed, setFailed] = useState(false);

  if (!visual?.meta) {
    return null;
  }

  if (!visual.src || failed) {
    return <Placeholder visual={visual} variant={variant} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={visual.src}
      alt={visual.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
}
