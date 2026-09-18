import fs from "fs";
import path from "path";
import { getAllServices } from "../catalog";
import { getBrandsForService } from "../brands";
import { phoneForService, type Phone } from "../phones";

const ROOT = process.cwd();

function loadOffersCoverage(): Record<string, string[]> {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "offers-coverage.json"), "utf8"));
  } catch {
    return {};
  }
}

const PHONE_LABEL: Record<string, string> = {
  [phoneJoin(phoneForService("kp"))]: "КП",
  [phoneJoin(phoneForService("santehnik"))]: "МнЧ",
  [phoneJoin(phoneForService("remont-holodilnikov"))]: "БТ",
};

function phoneJoin(p: Phone): string {
  return p.href;
}

export interface ServiceCoverage {
  serviceSlug: string;
  service: string;
  sitePages: number; // сколько гео-страниц реально сгенерено на сайте
  offerCities: number; // сколько городов реально принимает оффер (из таблицы партнёра)
  coveredPct: number;
  brandsCount: number;
  phoneLabel: string;
  phoneDisplay: string;
}

export function getCoverageStats(): { services: ServiceCoverage[]; totalCities: number } {
  const offers = loadOffersCoverage();
  const services = getAllServices();

  const rows: ServiceCoverage[] = services.map((s) => {
    const offerCities = offers[s.serviceSlug]?.length ?? 0;
    const phone = phoneForService(s.serviceSlug);
    return {
      serviceSlug: s.serviceSlug,
      service: s.service,
      sitePages: s.cityCount,
      offerCities,
      coveredPct: s.cityCount > 0 ? Math.round((offerCities / s.cityCount) * 100) : 0,
      brandsCount: getBrandsForService(s.serviceSlug).length,
      phoneLabel: PHONE_LABEL[phoneJoin(phone)] ?? "?",
      phoneDisplay: phone.display,
    };
  });

  rows.sort((a, b) => a.coveredPct - b.coveredPct);

  const totalCities = Math.max(...services.map((s) => s.cityCount), 0);
  return { services: rows, totalCities };
}
