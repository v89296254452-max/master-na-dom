#!/usr/bin/env node
/**
 * Лёгкая проверка живости инстанса — используется deploy.sh перед и после
 * переключения current, и доступна отдельно: npm run healthcheck -- --base=http://127.0.0.1:3005
 *
 * Nameренно не тяжёлые проверки (никаких полных обходов sitemap) — только
 * /api/health + пара представительных страниц по одному разу каждая.
 */
const base = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://127.0.0.1:3000").slice("--base=".length);
const sampleSlug = (process.argv.find((a) => a.startsWith("--sample-slug=")) || "").slice("--sample-slug=".length);

const checks = [
  { path: "/api/health", expect: 200 },
  { path: "/", expect: 200 },
  { path: "/robots.txt", expect: 200 },
  { path: "/sitemap.xml", expect: 200 },
  { path: "/goroda/kazan", expect: 200 },
  { path: "/uslugi/remont-stiralnyh-mashin", expect: 200 },
];
if (sampleSlug) checks.push({ path: `/${sampleSlug}`, expect: 200 });

let failed = 0;
for (const { path, expect } of checks) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000) });
    const ok = res.status === expect;
    if (!ok) failed++;
    console.log(`${ok ? "OK  " : "FAIL"} ${path} -> ${res.status} (${Date.now() - t0}ms)`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${path} -> ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failed > 0) {
  console.error(`healthcheck: ${failed}/${checks.length} проверок провалено`);
  process.exit(1);
}
console.log(`healthcheck: все ${checks.length} проверок прошли (base=${base})`);
