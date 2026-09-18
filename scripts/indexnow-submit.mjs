/**
 * IndexNow: мгновенно уведомляет Яндекс/Bing/Seznam о страницах сайта.
 * Берёт список URL из живого sitemap.xml, шлёт в api.indexnow.org батчами.
 *
 *   node scripts/indexnow-submit.mjs                       # все URL из sitemap
 *   node scripts/indexnow-submit.mjs url1 url2             # только указанные URL
 *   node scripts/indexnow-submit.mjs --url=https://...      # то же, флагом (можно повторять)
 *
 * Ключ читается из .indexnow-key (или env INDEXNOW_KEY).
 * Файл-подтверждение public/<key>.txt должен быть задеплоен и отдавать ключ.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "master-na-dom.online";
const SITE = `https://${HOST}`;

function readKey() {
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY.trim();
  const p = path.join(ROOT, ".indexnow-key");
  return fs.readFileSync(p, "utf8").trim();
}

async function getUrlsFromSitemap() {
  // sitemap может быть индексом (sitemap-index) или обычным — обрабатываем оба
  const seen = new Set();
  async function pull(url) {
    const xml = await (await fetch(url)).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (/<sitemapindex/i.test(xml)) {
      for (const sm of locs) await pull(sm);
    } else {
      for (const u of locs) seen.add(u);
    }
  }
  await pull(`${SITE}/sitemap.xml`);
  return [...seen];
}

async function submit(key, urls) {
  const CHUNK = 10000; // лимит IndexNow на запрос
  let ok = 0;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const urlList = urls.slice(i, i + CHUNK);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `${SITE}/${key}.txt`,
        urlList,
      }),
    });
    console.log(`батч ${i / CHUNK + 1}: ${urlList.length} URL → HTTP ${res.status}`);
    if (res.ok || res.status === 202) ok += urlList.length;
    else console.log("  ответ:", (await res.text()).slice(0, 200));
  }
  return ok;
}

const key = readKey();
// Поддерживаем и позиционные URL, и --url=... (можно повторять несколько раз).
const args = process.argv
  .slice(2)
  .map((a) => (a.startsWith("--url=") ? a.slice("--url=".length) : a));
const urls = args.length ? args : await getUrlsFromSitemap();
console.log(`IndexNow: отправляю ${urls.length} URL (ключ ${key.slice(0, 8)}…)`);
const ok = await submit(key, urls);
console.log(`Готово. Принято к обработке: ${ok}/${urls.length}`);
