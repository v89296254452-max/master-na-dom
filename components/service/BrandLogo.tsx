"use client";

import { useState } from "react";
import Image from "next/image";

interface BrandLogoProps {
  src: string;
  className?: string;
  width?: number;
  height?: number;
}

function isRasterLogo(url: string): boolean {
  return /\.(webp|png|jpe?g)$/i.test(url);
}

export default function BrandLogo({
  src,
  className = "h-9 w-auto",
  width = 140,
  height = 36,
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const currentSrc = failed ? "/assets/logo-promaster.svg" : src;
  const raster = isRasterLogo(currentSrc);

  // SVG-фолбэк отдаём как есть (инверсия под тёмный hero), без оптимизатора.
  if (!raster) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={currentSrc}
        alt="ПроМастер"
        width={width}
        height={height}
        className={`${className} brightness-0 invert`}
      />
    );
  }

  return (
    <Image
      src={currentSrc}
      alt="ПроМастер"
      width={width}
      height={height}
      onError={() => setFailed(true)}
      className={className}
      priority
    />
  );
}
