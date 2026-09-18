#!/usr/bin/env node
/**
 * Безопасный прогрев ISR-кэша после деплоя/рестарта — не весь sitemap (50k+
 * URL), а только приоритетный список, ограниченной параллельностью, чтобы
 * не устроить самим себе повторение инцидента с ростом RSS (см.
 * docs/PRODUCTION-MEMORY-AUDIT.md).
 *
 *   npm run cache:warm -- --source=priority --limit=500 --concurrency=3
 *   npm run cache:warm -- --source=priority --base=http://127.0.0.1:3001
 *
 * --source=priority (по умолчанию) — data/prebuild-priority.json + все
 *   city/service хабы (goroda/uslugi — они и так prebuilt, но проверка их
 *   доступности дёшева и полезна как часть healthcheck).
 * --source=sitemap — берёт URL из живого /sitemap.xml (полный список,
 *   используйте --limit, иначе легко случайно прогреть тысячи URL).
 * --limit=N — максимум URL за прогон (по умолчанию 500).
 * --concurrency=N — параллельность (по умолчанию 3, разумный потолок 2-4).
 * --base=URL — куда стучаться (по умолчанию http://127.0.0.1:3000).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = { source: "priority", limit: 500, concurrency: 3, base: "http://127.0.0.1:3000" };
  for (const a of argv) {
    const m = a.match(/^--([a-z]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "limit" || k === "concurrency") out[k] = parseInt(v, 10) || out[k];
    else out[k] = v;
  }
  return out;
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

function priorityUrls() {
  const priority = readJson(path.join(ROOT, "data", "prebuild-priority.json"), {
    brandPages: [],
    problemPages: [],
    problemServicePages: [],
  });
  // Хабы (/goroda/*, /uslugi/*) сюда намеренно не включены — они уже SSG
  // (generateStaticParams при билде, см. docs/PRODUCTION-MEMORY-AUDIT.md,
  // раздел 2), прогревать нечего.
  const urls = ["/"];
  for (const slug of priority.brandPages || []) urls.push(`/${slug}`);
  for (const slug of priority.problemPages || []) urls.push(`/problem/${slug}`);
  for (const slug of priority.problemServicePages || []) urls.push(`/problem-service/${slug}`);
  return urls;
}

async function sitemapUrls(base) {
  const seen = new Set();
  async function pull(url) {
    const res = await fetch(url);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (/<sitemapindex/i.test(xml)) {
      for (const sm of locs) await pull(sm);
    } else {
      for (const u of locs) seen.add(new URL(u).pathname);
    }
  }
  await pull(`${base}/sitemap.xml`);
  return [...seen];
}

async function warmOne(base, pathName) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}${pathName}`, { method: "GET" });
    await res.arrayBuffer(); // дочитать тело, иначе соединение не освобождается
    return { pathName, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { pathName, status: -1, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[cache-warm] source=${args.source} limit=${args.limit} concurrency=${args.concurrency} base=${args.base}`);

  let urls = args.source === "sitemap" ? await sitemapUrls(args.base) : priorityUrls();
  const total = urls.length;
  urls = urls.slice(0, args.limit);
  if (total > urls.length) {
    console.log(`[cache-warm] ${total} URL доступно, ограничено до ${urls.length} флагом --limit (безопасность: не прогреваем всё сразу)`);
  }

  const t0 = Date.now();
  const results = await runPool(urls, args.concurrency, (u) => warmOne(args.base, u));
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const failed = results.filter((r) => r.status !== 200);

  console.log(`[cache-warm] готово за ${elapsed}с: ${urls.length} URL, коды: ${JSON.stringify(byStatus)}`);
  if (failed.length) {
    console.log(`[cache-warm] ${failed.length} не вернули 200:`);
    for (const f of failed.slice(0, 20)) console.log(`  ${f.status} ${f.pathName}${f.error ? " (" + f.error + ")" : ""}`);
  }
  process.exit(failed.length > urls.length * 0.5 ? 1 : 0); // >50% фейлов — сигнал реальной проблемы
}

main().catch((e) => {
  console.error("[cache-warm] fatal:", e);
  process.exit(1);
});
