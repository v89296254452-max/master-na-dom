import fs from "fs";
import path from "path";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const DZEN_IMAGES_DIR = "dzen-images";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function listDzenImageFiles(): string[] {
  const absoluteDir = path.join(PUBLIC_ROOT, DZEN_IMAGES_DIR);

  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  return fs
    .readdirSync(absoluteDir)
    .filter((name) => {
      const absolutePath = path.join(absoluteDir, name);
      if (!fs.statSync(absolutePath).isFile()) {
        return false;
      }
      return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
    })
    .map((name) => `/${DZEN_IMAGES_DIR}/${name}`.replace(/\\/g, "/"))
    .sort((a, b) => a.localeCompare(b));
}

export function getRandomImages(count = 3): string[] {
  if (count <= 0) {
    return [];
  }

  const files = listDzenImageFiles();
  if (files.length === 0) {
    return [];
  }

  const shuffled = [...files].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
