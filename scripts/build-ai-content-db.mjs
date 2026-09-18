#!/usr/bin/env node
/**
 * Собирает data/ai-content.db (SQLite) из всех JSON-источников контента:
 *   data/ai-content.json          — гео + проблемные (main)
 *   data/ai-content.brand.json    — бренды
 *   data/ai-content.problems.json — проблемные (если ещё не в main)
 *
 * Таблица content(slug TEXT PRIMARY KEY, data TEXT). Один запрос по slug в
 * рантайме — без загрузки монолита в память (см. lib/ai-content.ts).
 *
 * Идемпотентно: пересобирает БД с нуля. Запуск: node scripts/build-ai-content-db.mjs
 *
 * Файлы читаются потоково-безопасно: каждый парсится по отдельности (каждый
 * < лимита строки V8), поэтому 550 МБ-монолита в памяти не возникает.
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
// money.json — ПОСЛЕДНИМ: углублённый контент топ-страниц перекрывает базовый
// (INSERT OR REPLACE — позже вставленное побеждает).
const SOURCES = ["data/ai-content.json", "data/ai-content.brand.json", "data/ai-content.problems.json", "data/ai-content.money.json", "data/ai-content.problems-facts.json"];
const DB_PATH = path.join(ROOT, "data", "ai-content.db");
const TMP_PATH = DB_PATH + ".building";

function main() {
  if (fs.existsSync(TMP_PATH)) fs.unlinkSync(TMP_PATH);
  const db = new Database(TMP_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec("CREATE TABLE content (slug TEXT PRIMARY KEY, data TEXT NOT NULL)");

  const insert = db.prepare("INSERT OR REPLACE INTO content (slug, data) VALUES (?, ?)");
  const insertMany = db.transaction((entries) => {
    for (const [slug, data] of entries) insert.run(slug, data);
  });

  let total = 0;
  for (const rel of SOURCES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) {
      console.log(`  пропуск (нет файла): ${rel}`);
      continue;
    }
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (e) {
      console.error(`  ОШИБКА парса ${rel}: ${e.message}`);
      continue;
    }
    const batch = [];
    let count = 0;
    for (const slug in obj) {
      const e = obj[slug];
      if (!e || !Array.isArray(e.paragraphs) || e.paragraphs.length === 0) continue;
      // храним только нужные поля
      batch.push([slug, JSON.stringify({ description: e.description, paragraphs: e.paragraphs, faqs: e.faqs })]);
      count++;
      if (batch.length >= 5000) { insertMany(batch); batch.length = 0; }
    }
    if (batch.length) insertMany(batch);
    total += count;
    console.log(`  ${rel}: +${count} записей`);
    obj = null; // освобождаем память перед следующим файлом
  }

  const inDb = db.prepare("SELECT COUNT(*) c FROM content").get().c;
  db.close();

  // атомарная замена
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  for (const suf of ["", "-wal", "-shm"]) {
    if (fs.existsSync(TMP_PATH + suf)) fs.renameSync(TMP_PATH + suf, DB_PATH + suf);
  }
  console.log(`\nГотово: ${inDb} записей в data/ai-content.db (обработано ${total}).`);
}

main();
