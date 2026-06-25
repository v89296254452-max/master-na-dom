import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");
const cachePath = path.join(projectRoot, "data", "office-geocode-cache.json");

const STREETS = [
  "ул. Ленина",
  "ул. Советская",
  "ул. Мира",
  "пр. Победы",
  "ул. Кирова",
  "ул. Гагарина",
  "пр. Ленина",
  "ул. Центральная",
  "ул. Московская",
  "ул. Комсомольская",
  "ул. Пушкина",
  "ул. Горького",
  "пр. Мира",
  "ул. Садовая",
  "ул. Набережная",
];

const CITY_ALIASES = {
  СПБ: "Санкт-Петербург",
  "Ростов на Дону": "Ростов-на-Дону",
  "Красная поляна": "Красная Поляна",
  Щекино: "Щёкино",
  "Калинингдрад": "Калининград",
  "Ханты-мансийск": "Ханты-Мансийск",
  Тест_БН: null,
};

function hashCity(city) {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = (hash * 31 + city.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildAddress(city) {
  const hash = hashCity(city);
  const street = STREETS[hash % STREETS.length];
  const number = (hash % 170) + 12;
  return `${street}, ${number}`;
}

function readCities() {
  const csv = fs.readFileSync(path.join(projectRoot, "data", "pages.csv"), "utf8");
  const cities = new Set();
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const city = line.split(",")[1]?.trim();
    if (city && CITY_ALIASES[city] !== null) cities.add(city);
  }
  return [...cities].sort((a, b) => a.localeCompare(b, "ru"));
}

function loadCache() {
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

async function geocodeCity(city) {
  const queryCity = CITY_ALIASES[city] ?? city;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&city=${encodeURIComponent(queryCity)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "master-leads-seo/1.0 (office generator)" },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${city}`);
  }

  const data = await res.json();
  if (!data[0]) {
    const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&q=${encodeURIComponent(`${queryCity}, Россия`)}`;
    const fallbackRes = await fetch(fallbackUrl, {
      headers: { "User-Agent": "master-leads-seo/1.0 (office generator)" },
    });
    const fallbackData = await fallbackRes.json();
    if (!fallbackData[0]) return null;
    return {
      lat: Number(fallbackData[0].lat),
      lng: Number(fallbackData[0].lon),
    };
  }

  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
  };
}

function escapeKey(key) {
  if (/^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*$/.test(key)) {
    return key;
  }
  return `"${key.replace(/"/g, '\\"')}"`;
}

function writeOfficesFile(cities, addresses, coords) {
  const addressLines = cities
    .map((city) => `  ${escapeKey(city)}: "${addresses[city].replace(/"/g, '\\"')}",`)
    .join("\n");

  const coordLines = cities
    .filter((city) => coords[city])
    .map((city) => {
      const { lat, lng } = coords[city];
      return `  ${escapeKey(city)}: { lat: ${lat.toFixed(6)}, lng: ${lng.toFixed(6)} },`;
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
}

async function main() {
  const cities = readCities();
  const cache = loadCache();
  const addresses = {};
  const coords = {};

  for (const city of cities) {
    addresses[city] = buildAddress(city);

    if (cache[city]) {
      coords[city] = cache[city];
      continue;
    }

    process.stdout.write(`Geocoding ${city}... `);
    try {
      const point = await geocodeCity(city);
      if (point) {
        coords[city] = point;
        cache[city] = point;
        saveCache(cache);
        console.log(`${point.lat}, ${point.lng}`);
      } else {
        console.log("NOT FOUND");
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 1100));
  }

  writeOfficesFile(cities, addresses, coords);
  console.log(`\nDone: ${cities.length} cities, ${Object.keys(coords).length} with coordinates.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
