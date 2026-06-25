import type { Page } from "../pages";
import {
  getBrandAssets,
  getDetailVisuals,
  getHeroVisual,
  getWorkGallery,
} from "../images";

/** @deprecated Используйте lib/images.ts */
export function getServiceImageView(page: Page) {
  return getHeroVisual(page);
}

export { getHeroVisual, getWorkGallery, getDetailVisuals, getBrandAssets };
