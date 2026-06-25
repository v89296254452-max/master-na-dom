import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import {
  buildProblemArticle,
  MAIN_PROBLEM_SERVICES,
  PROBLEM_TEMPLATES,
  type CsvPageInput,
} from "../lib/problem-generator";
import type { ProblemArticle } from "../lib/problem-types";
import { formatServiceInCity } from "../lib/pages";

const TARGET_COUNT = 100;
const CITIES_PER_PROBLEM = 2;

interface CsvRow {
  slug: string;
  city: string;
  cityPrepositional: string;
  service: string;
  serviceSlug: string;
  phone: string;
}

function main() {
  const csvPath = path.join(process.cwd(), "data", "pages.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const pages = parse(raw, { columns: true, skip_empty_lines: true }) as CsvRow[];

  const byService = new Map<string, CsvRow[]>();
  for (const slug of MAIN_PROBLEM_SERVICES) {
    byService.set(
      slug,
      pages.filter((p) => p.serviceSlug === slug)
    );
  }

  const problems: ProblemArticle[] = [];
  const seenSlugs = new Set<string>();
  let idCounter = 1;

  for (const serviceSlug of MAIN_PROBLEM_SERVICES) {
    const templates = PROBLEM_TEMPLATES[serviceSlug];
    const servicePages = byService.get(serviceSlug) ?? [];
    if (!templates?.length || !servicePages.length) continue;

    for (let ti = 0; ti < templates.length; ti++) {
      const template = templates[ti];
      let cityOffset = 0;

      for (let ci = 0; ci < CITIES_PER_PROBLEM; ci++) {
        if (problems.length >= TARGET_COUNT) break;

        let page: CsvRow | undefined;

        for (let attempt = 0; attempt < servicePages.length; attempt++) {
          const candidate = servicePages[(ti * CITIES_PER_PROBLEM + ci + cityOffset + attempt) % servicePages.length];
          const candidateSlug = `${template.slugPart}-${candidate.slug}`;
          if (!seenSlugs.has(candidateSlug)) {
            page = candidate;
            break;
          }
        }

        if (!page) continue;

        const slug = `${template.slugPart}-${page.slug}`;
        seenSlugs.add(slug);
        cityOffset++;

        const sameCityProblems = templates
          .filter((t) => t.key !== template.key)
          .slice(0, 5)
          .map((t) => `${t.slugPart}-${page!.slug}`);

        const relatedServices = pages
          .filter((p) => p.city === page.city && p.slug !== page.slug)
          .slice(0, 4)
          .map((p) => ({
            title: formatServiceInCity(p),
            href: `/${p.slug}`,
          }));

        const createdAt = new Date(Date.now() - idCounter * 86400000)
          .toISOString()
          .slice(0, 10);

        problems.push(
          buildProblemArticle(
            page as CsvPageInput,
            template,
            String(idCounter++),
            sameCityProblems,
            relatedServices,
            createdAt
          )
        );
      }
    }
  }

  const outPath = path.join(process.cwd(), "data", "problems.json");
  fs.writeFileSync(outPath, JSON.stringify(problems, null, 0), "utf-8");
  console.log(`Generated ${problems.length} problem pages → ${outPath}`);
}

main();
