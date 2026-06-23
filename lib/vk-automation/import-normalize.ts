import crypto from "crypto";

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeRussianText(value: string): string {
  let text = value.normalize("NFC");
  text = text.replace(/\u00A0/g, " ");
  text = text.replace(/\t+/g, " ");
  text = text.replace(/\r\n/g, "\n");
  return normalizeWhitespace(text);
}

export function normalizeCityName(value: string): string {
  const trimmed = normalizeRussianText(value);
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function normalizeServiceName(value: string): string {
  const trimmed = normalizeRussianText(value);
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function normalizeLogin(value: string): string {
  return value.replace(/\D/g, "").trim();
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return digits;
}

export function normalizeProxyUrl(value: string): string {
  return normalizeWhitespace(value);
}

export function normalizeGroupUrl(value: string): string {
  const trimmed = normalizeWhitespace(value).replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.match(/^(club|public)\d+/i)) {
    return `https://vk.com/${trimmed}`;
  }
  return `https://vk.com/${trimmed}`;
}

export function normalizeKeyword(value: string): string {
  return normalizeRussianText(value).toLowerCase();
}

export function hashContent(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

export function dedupeKeyAccount(login: string): string {
  return `login:${normalizeLogin(login)}`;
}

export function dedupeKeyProxy(url: string): string {
  return `proxy:${normalizeProxyUrl(url).toLowerCase()}`;
}

export function dedupeKeyCity(name: string): string {
  return `city:${normalizeCityName(name).toLowerCase()}`;
}

export function dedupeKeyCityService(city: string, service: string): string {
  return `task:${normalizeCityName(city).toLowerCase()}:${normalizeServiceName(service).toLowerCase()}`;
}

export function dedupeKeyGroupUrl(url: string): string {
  const normalized = normalizeGroupUrl(url).toLowerCase();
  const club = normalized.match(/vk\.com\/(?:club|public)(\d+)/);
  if (club) return `group:club${club[1]}`;
  return `group:${normalized}`;
}

export function dedupeKeyKeyword(keyword: string, city = "", service = ""): string {
  const parts = [normalizeKeyword(keyword)];
  if (city) parts.push(normalizeCityName(city).toLowerCase());
  if (service) parts.push(normalizeServiceName(service).toLowerCase());
  return `keyword:${parts.join(":")}`;
}

export function dedupeKeyTemplate(content: string, kind: string): string {
  return `template:${kind}:${hashContent(content)}`;
}

export function dedupeKeyMedia(sourcePath: string): string {
  return `media:${hashContent(sourcePath.toLowerCase())}`;
}

export function dedupeKeyPhone(phone: string): string {
  return `phone:${normalizePhone(phone)}`;
}

export function parseAccountLine(line: string, proxy?: string): { login: string; password: string; proxy: string } | null {
  const separators = [":", ";", "|", "\t"];
  for (const sep of separators) {
    if (line.includes(sep)) {
      const parts = line.split(sep);
      const login = normalizeLogin(parts[0] ?? "");
      const password = (parts[1] ?? "").trim();
      if (login) {
        return {
          login,
          password,
          proxy: proxy ?? (parts[2] ?? "").trim(),
        };
      }
    }
  }
  const loginOnly = normalizeLogin(line);
  if (loginOnly) {
    return { login: loginOnly, password: "", proxy: proxy ?? "" };
  }
  return null;
}
