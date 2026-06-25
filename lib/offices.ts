import {
  CONTACT_EMAIL,
  getOfficeAddress,
  OFFICE_COORDS,
} from "@/data/offices";

export { CONTACT_EMAIL, getOfficeAddress };

export interface OfficeInfo {
  address: string;
  lat?: number;
  lng?: number;
}

export function getOfficeForCity(city: string): OfficeInfo | null {
  const address = getOfficeAddress(city);
  if (!address) return null;

  const coords = OFFICE_COORDS[city.trim()];
  return {
    address,
    lat: coords?.lat,
    lng: coords?.lng,
  };
}

export function getAddressLabel(city: string): string {
  return getOfficeAddress(city) ?? "Выездной сервис по городу";
}

export function getMapEmbedUrl(city: string, address: string): string {
  const coords = OFFICE_COORDS[city.trim()];

  if (coords?.lat && coords?.lng) {
    const ll = `${coords.lng},${coords.lat}`;
    const params = new URLSearchParams({
      ll,
      z: "16",
      pt: `${ll},pm2rdm`,
      l: "map",
    });
    return `https://yandex.ru/map-widget/v1/?${params.toString()}`;
  }

  const params = new URLSearchParams({
    text: `${city}, ${address}`,
    z: "16",
  });
  return `https://yandex.ru/map-widget/v1/?${params.toString()}`;
}
