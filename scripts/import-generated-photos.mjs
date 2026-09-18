/**
 * Импорт сгенерированных фото в public/images/promaster.
 *
 * Приводит PNG к тем же размерам и форматам, что уже используются на сайте:
 *   герой услуги      1200×750 → <slug>.{jpg,webp,avif}
 *   галерея работ      800×500 → work/<slug>-N.{jpg,webp,avif}
 *
 * Запуск: node scripts/import-generated-photos.mjs <папка-с-png>
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error("Укажите папку с PNG: node scripts/import-generated-photos.mjs <dir>");
  process.exit(1);
}

const OUT = path.join(process.cwd(), "public", "images", "promaster");
const WORK = path.join(OUT, "work");
const HERO = { w: 1200, h: 750 };
const GALLERY = { w: 800, h: 500 };

fs.mkdirSync(WORK, { recursive: true });

async function emit(srcFile, destDir, name, size) {
  const base = sharp(srcFile).resize(size.w, size.h, { fit: "cover", position: "centre" });
  await base.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(destDir, `${name}.jpg`));
  await base.clone().webp({ quality: 78 }).toFile(path.join(destDir, `${name}.webp`));
  await base.clone().avif({ quality: 50 }).toFile(path.join(destDir, `${name}.avif`));
  console.log(`  ${name} → ${size.w}×${size.h} jpg/webp/avif`);
}

const files = fs.readdirSync(SRC).filter((f) => /^gen-.+\.png$/i.test(f));
if (files.length === 0) {
  console.error(`В ${SRC} нет файлов gen-*.png`);
  process.exit(1);
}

for (const file of files.sort()) {
  const stem = file.replace(/^gen-/, "").replace(/\.png$/i, "");
  const heroMatch = stem.match(/^(.+)-hero$/);
  if (heroMatch) {
    await emit(path.join(SRC, file), OUT, heroMatch[1], HERO);
    continue;
  }
  const workMatch = stem.match(/^(.+)-(\d+)$/);
  if (workMatch) {
    await emit(path.join(SRC, file), WORK, `${workMatch[1]}-${workMatch[2]}`, GALLERY);
    continue;
  }
  console.warn(`  пропущен (непонятное имя): ${file}`);
}

console.log(`\nГотово: обработано ${files.length} файлов.`);
