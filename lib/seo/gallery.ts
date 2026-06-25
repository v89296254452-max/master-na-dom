import type { Page } from "../pages";
import { getWorkGallery, type PageVisual } from "../images";

/** @deprecated Используйте getWorkGallery из lib/images.ts */
export type GalleryImage = PageVisual;

export function getServiceGallery(page: Page): PageVisual[] {
  return getWorkGallery(page);
}

export { getWorkGallery };
