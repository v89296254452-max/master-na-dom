import fs from "fs";
import path from "path";
import { getAllPages, getServiceSlug } from "../lib/pages";
import { PROBLEM_MATRIX, SERVICE_CALL_LABEL } from "../lib/problems-cluster";

const OUTPUT_PATH = path.join(process.cwd(), "data", "problems-cluster.csv");

const CSV_COLUMNS = [
  "slug",
  "service",
  "city",
  "cityDat",
  "problem",
  "problemSlug",
  "title",
  "h1",
  "description",
] as const;

/** Крупные города идут первыми (приоритет генерации/листинга) */
const PRIORITY_CITIES = [
  "Москва",
  "Санкт-Петербург",
  "Екатеринбург",
  "Казань",
  "Нижний Новгород",
  "Новосибирск",
  "Челябинск",
  "Самара",
  "Краснодар",
];

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

interface ClusterRow {
  slug: string;
  service: string;
  city: string;
  cityDat: string;
  problem: string;
  problemSlug: string;
  title: string;
  h1: string;
  description: string;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pickWithinLimit(candidates: string[], max: number): string {
  for (const c of candidates) {
    if (c.length <= max) return c;
  }
  return candidates[candidates.length - 1].slice(0, max).trim();
}

function buildTitle(problemCap: string, cityDat: string, callLabel: string): string {
  return pickWithinLimit(
    [
      `${problemCap} в ${cityDat} — вызов ${callLabel} на дом | ПроМастер`,
      `${problemCap} в ${cityDat} — ${callLabel} на дом`,
      `${problemCap} в ${cityDat} — ПроМастер`,
      `${problemCap} в ${cityDat}`,
    ],
    TITLE_MAX
  );
}

function buildDescription(service: string, cityDat: string, problem: string): string {
  const lead = `${service} в ${cityDat}: ${problem} — устраним за 1 визит.`;
  return pickWithinLimit(
    [
      `${lead} Выезд от 30 минут, диагностика бесплатно, гарантия 12 месяцев. Звоним 24/7.`,
      `${lead} Выезд от 30 минут, диагностика бесплатно, гарантия 12 месяцев.`,
      `${lead} Выезд от 30 минут, гарантия 12 месяцев.`,
      lead,
    ],
    DESCRIPTION_MAX
  );
}

function cityPriority(city: string): number {
  const idx = PRIORITY_CITIES.indexOf(city);
  return idx === -1 ? PRIORITY_CITIES.length : idx;
}

function esc(value: string): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function rowsToCsv(rows: ClusterRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c])).join(","));
  return [header, ...body].join("\n") + "\n";
}

function main() {
  const pages = getAllPages();
  const rows: ClusterRow[] = [];
  const seen = new Set<string>();
  const perService: Record<string, number> = {};

  for (const page of pages) {
    if (!page.slug || !page.city) continue;
    const serviceSlug = getServiceSlug(page);
    const problems = PROBLEM_MATRIX[serviceSlug];
    if (!problems) continue;

    const service = page.service || "Услуга";
    const cityDat = page.cityPrepositional || page.city;
    const callLabel = SERVICE_CALL_LABEL[serviceSlug] ?? "мастера";

    for (const def of problems) {
      const slug = `${page.slug}-${def.problemSlug}`;
      if (seen.has(slug)) continue;
      seen.add(slug);

      const problemCap = capitalize(def.problem);

      rows.push({
        slug,
        service,
        city: page.city,
        cityDat,
        problem: def.problem,
        problemSlug: def.problemSlug,
        title: buildTitle(problemCap, cityDat, callLabel),
        h1: `${problemCap} в ${cityDat} — ${service.toLowerCase()} на дом`,
        description: buildDescription(service, cityDat, def.problem),
      });

      perService[serviceSlug] = (perService[serviceSlug] ?? 0) + 1;
    }
  }

  rows.sort((a, b) => {
    const pa = cityPriority(a.city);
    const pb = cityPriority(b.city);
    if (pa !== pb) return pa - pb;
    if (a.city !== b.city) return a.city.localeCompare(b.city, "ru");
    if (a.problemSlug !== b.problemSlug) return a.problemSlug.localeCompare(b.problemSlug);
    return a.slug.localeCompare(b.slug);
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rowsToCsv(rows), "utf-8");

  console.log("Источник:", path.join(process.cwd(), "data", "pages.csv"));
  console.log("По направлениям:");
  for (const [svc, count] of Object.entries(perService)) {
    console.log(`  ${svc}: ${count}`);
  }
  console.log("Всего строк:", rows.length);
  console.log("Файл:", OUTPUT_PATH);
}

main();
