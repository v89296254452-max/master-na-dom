import fs from "fs";
import path from "path";

const IMAGE_PATTERN = /\.(webp|png|jpe?g|svg)$/i;

const PREFERRED_NAMES = [
  "logo-promaster.webp",
  "logo-promaster.png",
  "logo-promaster.svg",
];

function isAsciiPathSegment(name: string): boolean {
  return /^[\x20-\x7E]+$/.test(name);
}

let cachedLogoUrl: string | undefined;

function pickLogoFromDir(relativeDir: string): string | null {
  const dir = path.join(process.cwd(), "public", relativeDir);
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => IMAGE_PATTERN.test(f) && !f.startsWith(".") && isAsciiPathSegment(f));

  for (const preferred of PREFERRED_NAMES) {
    const match = files.find((f) => f.toLowerCase() === preferred.toLowerCase());
    if (match) return `/${relativeDir}/${match}`.replace(/\\/g, "/");
  }

  const any = files.sort((a, b) => a.localeCompare(b, "en"))[0];
  return any ? `/${relativeDir}/${any}`.replace(/\\/g, "/") : null;
}

/** Путь к логотипу бренда в public/ (с fallback) */
export function getBrandLogoUrl(): string {
  if (cachedLogoUrl) return cachedLogoUrl;

  cachedLogoUrl =
    pickLogoFromDir("images/brand") ??
    pickLogoFromDir("assets") ??
    "/assets/logo-promaster.svg";

  return cachedLogoUrl;
}

export function isRasterLogo(url: string): boolean {
  return /\.(webp|png|jpe?g)$/i.test(url);
}
