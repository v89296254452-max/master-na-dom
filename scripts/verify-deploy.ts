import fs from "fs";
import { parse } from "csv-parse/sync";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.ru";

async function fetchText(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.text();
}

async function main() {
  const errors: string[] = [];

  const robots = await fetchText("/robots.txt");
  if (!robots.includes(`Sitemap: ${SITE.replace(/\/+$/, "")}/sitemap.xml`)) {
    errors.push(`robots.txt sitemap mismatch. Got:\n${robots}`);
  }
  if (!robots.includes("Allow: /")) {
    errors.push("robots.txt missing Allow: /");
  }

  const sitemap = await fetchText("/sitemap.xml");
  const slugs = parse(fs.readFileSync("data/pages.csv", "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }).map((r: { slug: string }) => r.slug).filter(Boolean);

  const site = SITE.replace(/\/+$/, "");
  if (!sitemap.includes(`<loc>${site}</loc>`)) {
    errors.push("sitemap.xml missing homepage URL");
  }
  if (!sitemap.includes(`<loc>${site}/kp-abakan</loc>`)) {
    errors.push("sitemap.xml missing sample page kp-abakan");
  }
  const urlCount = (sitemap.match(/<loc>/g) ?? []).length;
  if (urlCount !== slugs.length + 1) {
    errors.push(`sitemap.xml URL count ${urlCount}, expected ${slugs.length + 1}`);
  }

  const leadRes = await fetch(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Deploy Test",
      phone: "+7 (999) 123-45-67",
      problem: "test",
      city: "Москва",
      service: "Сантехник",
      slug: "test-slug",
      source: "deploy-check",
    }),
  });
  const leadJson = await leadRes.json();
  if (!leadRes.ok || !leadJson.success) {
    errors.push(`POST /api/leads failed: ${leadRes.status} ${JSON.stringify(leadJson)}`);
  }

  let pageFails = 0;
  const sample = [slugs[0], slugs[Math.floor(slugs.length / 2)], slugs[slugs.length - 1]];
  for (const slug of sample) {
    const res = await fetch(`${BASE}/${slug}`);
    if (res.status !== 200) {
      errors.push(`GET /${slug} -> ${res.status}`);
      pageFails++;
    }
  }

  const batchSize = 50;
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (slug: string) => {
        const res = await fetch(`${BASE}/${slug}`, { method: "HEAD" });
        return { slug, status: res.status };
      })
    );
    for (const r of results) {
      if (r.status !== 200) {
        pageFails++;
        if (errors.length < 20) errors.push(`GET /${r.slug} -> ${r.status}`);
      }
    }
    if ((i + batchSize) % 200 === 0 || i + batchSize >= slugs.length) {
      console.log(`Checked ${Math.min(i + batchSize, slugs.length)}/${slugs.length} pages, fails: ${pageFails}`);
    }
  }

  if (errors.length) {
    console.error("DEPLOY CHECK FAILED:");
    errors.forEach((e) => console.error("-", e));
    process.exit(1);
  }

  console.log("DEPLOY CHECK OK");
  console.log(`- robots.txt OK (Sitemap: ${site}/sitemap.xml)`);
  console.log(`- sitemap.xml OK (${urlCount} URLs)`);
  console.log("- POST /api/leads OK");
  console.log(`- All ${slugs.length} pages return 200`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
