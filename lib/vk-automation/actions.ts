import type { Page } from "playwright";
import { delay } from "./browser";
import type { VkAutomationLogger } from "./logger";

export async function clickFirstVisible(
  page: Page,
  selectors: string[],
  logger: VkAutomationLogger,
  label: string
): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      logger.info(`Click ${label}: ${selector}`);
      await locator.click();
      await delay();
      return true;
    }
  }
  logger.warn(`Could not find element for ${label}`);
  return false;
}

export async function fillFirstVisible(
  page: Page,
  selectors: string[],
  value: string,
  logger: VkAutomationLogger,
  label: string
): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      logger.info(`Fill ${label}: ${selector}`);
      await locator.fill(value);
      await delay();
      return true;
    }
  }
  logger.warn(`Could not find input for ${label}`);
  return false;
}

export async function waitForUrlChange(
  page: Page,
  pattern: RegExp,
  timeoutMs = 30000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pattern.test(page.url())) return true;
    await delay(500);
  }
  return false;
}

export function extractGroupIdFromUrl(url: string): string {
  const clubMatch = url.match(/vk\.com\/club(\d+)/i);
  if (clubMatch) return clubMatch[1];

  const publicMatch = url.match(/vk\.com\/public(\d+)/i);
  if (publicMatch) return publicMatch[1];

  const pathMatch = url.match(/vk\.com\/([a-zA-Z0-9_.-]+)/);
  if (pathMatch && !["feed", "groups", "login", "id"].some((p) => pathMatch[1].startsWith(p))) {
    return pathMatch[1];
  }

  return "";
}

export function buildGroupUrl(identifier: string): string {
  const id = identifier.trim();
  if (!id) return "";
  if (id.startsWith("http")) return id;
  if (/^\d+$/.test(id)) return `https://vk.com/club${id}`;
  return `https://vk.com/${id}`;
}
