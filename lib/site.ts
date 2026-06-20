const DEFAULT_SITE_URL = "https://master-na-dom.online";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const url = raw || DEFAULT_SITE_URL;
  return url.replace(/\/+$/, "");
}
