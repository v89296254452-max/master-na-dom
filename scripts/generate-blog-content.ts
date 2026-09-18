import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { getAllPages, getServiceSlug, formatServiceInCity } from "../lib/pages";
import { buildArticle, BANKS, type Category, type ServiceLink } from "./blog-shared";

const CSV_PATH = path.join(process.cwd(), "data", "blog-posts.csv");
const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

const PREFERRED_CITIES = ["Москва", "Калуга", "Тверь", "Ярославль"];

/** Подбираем реальную коммерческую страницу услуги для внутренней ссылки. */
function buildServiceLinks(): Map<string, ServiceLink> {
  const pages = getAllPages().filter((p) => p.slug && p.city);
  const map = new Map<string, ServiceLink>();

  for (const serviceSlug of Object.keys(BANKS)) {
    const matches = pages.filter((p) => getServiceSlug(p) === serviceSlug);
    if (matches.length === 0) continue;

    let chosen = matches[0];
    for (const city of PREFERRED_CITIES) {
      const found = matches.find((p) => p.city === city);
      if (found) {
        chosen = found;
        break;
      }
    }

    const anchor = formatServiceInCity(chosen);
    map.set(serviceSlug, {
      href: `/${chosen.slug}`,
      anchor: anchor.charAt(0).toLowerCase() + anchor.slice(1),
    });
  }

  return map;
}

function frontmatter(row: Record<string, string>): string {
  const esc = (s: string) => s.replace(/"/g, '\\"');
  return [
    "---",
    `title: "${esc(row.title)}"`,
    `h1: "${esc(row.h1)}"`,
    `description: "${esc(row.description)}"`,
    `category: "${row.category}"`,
    `service: "${esc(row.service)}"`,
    `datePublished: "${row.datePublished}"`,
    "---",
  ].join("\n");
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error("Сначала запустите generate:blog-csv — нет data/blog-posts.csv");
    process.exit(1);
  }

  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  // Чистим папку, чтобы не оставалось «осиротевших» статей
  fs.rmSync(CONTENT_DIR, { recursive: true, force: true });
  fs.mkdirSync(CONTENT_DIR, { recursive: true });

  const links = buildServiceLinks();
  const SERVICE_SLUG_BY_NAME: Record<string, string> = {
    "Сантехник": "santehnik",
    "Электрик": "elektrik",
    "Ремонт стиральных машин": "remont-stiralnyh-mashin",
    "Ремонт холодильников": "remont-holodilnikov",
    "Компьютерная помощь": "kp",
    "Мастер на час": "master-na-chas",
    "Ремонт посудомоечных машин": "remont-pmm",
    "Ремонт кондиционеров": "remont-kondicionerov",
  };

  let written = 0;
  let minWords = Infinity;

  for (const row of rows) {
    const serviceSlug = SERVICE_SLUG_BY_NAME[row.service];
    const bank = BANKS[serviceSlug];
    if (!bank) continue;

    const body = buildArticle({
      slug: row.slug,
      h1: row.h1,
      category: row.category as Category,
      bank,
      link: links.get(serviceSlug) ?? null,
    });

    const words = body.split(/\s+/).filter(Boolean).length;
    minWords = Math.min(minWords, words);

    const file = path.join(CONTENT_DIR, `${row.slug}.mdx`);
    fs.writeFileSync(file, `${frontmatter(row)}\n\n${body}`, "utf-8");
    written++;
  }

  console.log(`✓ Создано ${written} статей в ${path.relative(process.cwd(), CONTENT_DIR)}`);
  console.log(`  Минимальный объём статьи: ${minWords} слов`);
}

main();
