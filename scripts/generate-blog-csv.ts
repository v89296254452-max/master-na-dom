import fs from "fs";
import path from "path";
import {
  TOPIC_MATRIX,
  categorize,
  buildSlug,
  buildSeoTitle,
  buildSeoDescription,
  buildKeywords,
  buildDate,
  getServiceSlugByName,
  resetSlugs,
  BANKS,
} from "./blog-shared";

const OUTPUT = path.join(process.cwd(), "data", "blog-posts.csv");

const COLUMNS = [
  "slug",
  "title",
  "h1",
  "description",
  "category",
  "service",
  "keywords",
  "datePublished",
] as const;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function main() {
  resetSlugs();

  const total = TOPIC_MATRIX.reduce((sum, g) => sum + g.titles.length, 0);
  const rows: Record<(typeof COLUMNS)[number], string>[] = [];
  let index = 0;

  for (const group of TOPIC_MATRIX) {
    const serviceSlug = getServiceSlugByName(group.service);
    const bank = BANKS[serviceSlug];
    const master = bank ? bank.master : group.service;

    for (const h1 of group.titles) {
      const category = categorize(h1);
      const slug = buildSlug(category, h1);

      rows.push({
        slug,
        title: buildSeoTitle(h1),
        h1,
        description: buildSeoDescription(category, h1, master),
        category,
        service: group.service,
        keywords: buildKeywords(h1, group.service),
        datePublished: buildDate(index, total),
      });

      index++;
    }
  }

  const header = COLUMNS.join(",");
  const body = rows
    .map((r) => COLUMNS.map((c) => csvEscape(r[c])).join(","))
    .join("\n");

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${header}\n${body}\n`, "utf-8");

  console.log(`✓ Сгенерировано ${rows.length} строк → ${path.relative(process.cwd(), OUTPUT)}`);
}

main();
