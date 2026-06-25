import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");

function escapeKey(key) {
  if (/^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*$/.test(key)) {
    return key;
  }
  return `"${key.replace(/"/g, '\\"')}"`;
}

const cache = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "office-geocode-cache.json"), "utf8")
);
const src = fs.readFileSync(path.join(projectRoot, "data", "offices.ts"), "utf8");
const addrBlock = src.match(/export const OFFICES_BY_CITY[\s\S]*?= \{([\s\S]*?)\};/)[1];

const cities = [];
for (const line of addrBlock.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//")) continue;

  const colon = trimmed.indexOf(":");
  if (colon === -1) continue;

  let cityPart = trimmed.slice(0, colon).trim();
  const valuePart = trimmed.slice(colon + 1).trim();
  const addressMatch = valuePart.match(/^"((?:\\.|[^"\\])*)"/);
  if (!addressMatch) continue;

  if (cityPart.startsWith('"') && cityPart.endsWith('"')) {
    cityPart = cityPart.slice(1, -1).replace(/\\"/g, '"');
  }

  cities.push({ city: cityPart, address: addressMatch[1].replace(/\\"/g, '"') });
}

const addressLines = cities
  .map((c) => `  ${escapeKey(c.city)}: "${c.address.replace(/"/g, '\\"')}",`)
  .join("\n");

const coordLines = cities
  .filter((c) => cache[c.city])
  .map((c) => {
    const p = cache[c.city];
    return `  ${escapeKey(c.city)}: { lat: ${p.lat.toFixed(6)}, lng: ${p.lng.toFixed(6)} },`;
  })
  .join("\n");

const content = `/**
 * Адреса офисов и координаты для карт.
 * Сгенерировано scripts/generate-offices.mjs — не редактировать вручную.
 */
export const OFFICES_BY_CITY: Record<string, string> = {
${addressLines}
};

export function getOfficeAddress(city: string): string | null {
  if (!city?.trim()) return null;
  return OFFICES_BY_CITY[city.trim()] ?? null;
}

/** Координаты центра города для карты */
export const OFFICE_COORDS: Record<string, { lat: number; lng: number }> = {
${coordLines}
};

export const CONTACT_EMAIL = "info@master-na-dom.online";
`;

fs.writeFileSync(path.join(projectRoot, "data", "offices.ts"), content, "utf8");
console.log(`Fixed ${cities.length} cities`);
