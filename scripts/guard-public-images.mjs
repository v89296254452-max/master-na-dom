import { guardPublicImages } from "./site-recover.mjs";

const removed = guardPublicImages();

if (removed.length > 0) {
  console.warn("Removed non-image public files (do not store data/ in public/images):");
  for (const item of removed) {
    console.warn(`  - ${item.startsWith("images/") ? item : `images${item}`}`);
  }
}
