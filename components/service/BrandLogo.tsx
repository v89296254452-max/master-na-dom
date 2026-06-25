"use client";

import { useState } from "react";

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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt="ПроМастер"
      width={width}
      height={height}
      onError={() => setFailed(true)}
      className={`${className}${raster ? "" : " brightness-0 invert"}`}
    />
  );
}
