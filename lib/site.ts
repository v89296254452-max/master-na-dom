const DEFAULT_SITE_URL = "https://example.ru";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const url = raw || DEFAULT_SITE_URL;
  return url.replace(/\/+$/, "");
}
