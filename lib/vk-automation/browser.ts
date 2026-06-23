import fs from "fs";
import path from "path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  ensureVkAutomationDirs,
  getAccountProfilePath,
  getAccountSessionPath,
  VK_AUTOMATION_CONFIG,
} from "./config";
import type { VkAutomationLogger } from "./logger";
import { buildContextOptions, getBrowserLaunchOptions } from "./queue";
import type { VkBrowserAccount } from "./types";

let sharedBrowser: Browser | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      ...getBrowserLaunchOptions(),
      channel: undefined,
    });
  }
  return sharedBrowser;
}

export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export async function openAccountContext(
  account: VkBrowserAccount,
  logger: VkAutomationLogger,
  options?: { headless?: boolean }
): Promise<BrowserContext> {
  ensureVkAutomationDirs();
  const profilePath = account.profilePath || getAccountProfilePath(account.id);
  const sessionPath = account.sessionPath || getAccountSessionPath(account.id);

  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  const contextOptions = buildContextOptions(account.proxy);
  const storageStateOption = fs.existsSync(sessionPath) ? { storageState: sessionPath } : {};

  logger.info(`Opening browser context profile=${profilePath}`);

  const context = await chromium.launchPersistentContext(profilePath, {
    ...getBrowserLaunchOptions(),
    ...contextOptions,
    ...storageStateOption,
    headless: options?.headless ?? VK_AUTOMATION_CONFIG.browserHeadless,
  });

  if (fs.existsSync(sessionPath)) {
    logger.info(`Loaded storageState from ${sessionPath}`);
  }

  return context;
}

export async function saveAccountStorageState(
  context: BrowserContext,
  account: VkBrowserAccount,
  logger: VkAutomationLogger
): Promise<string> {
  const sessionPath = account.sessionPath || getAccountSessionPath(account.id);
  const dir = path.dirname(sessionPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await context.storageState({ path: sessionPath });
  logger.info(`Saved storageState to ${sessionPath}`);
  return sessionPath;
}

export async function delay(ms?: number): Promise<void> {
  const wait = ms ?? VK_AUTOMATION_CONFIG.actionDelayMs;
  await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function safeScreenshot(
  page: Page,
  accountId: string,
  jobId: string,
  label: string
): Promise<string> {
  ensureVkAutomationDirs();
  const filename = `${accountId}_${jobId}_${label}_${Date.now()}.png`;
  const filePath = path.join(VK_AUTOMATION_CONFIG.screenshotsDir, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export async function withPage(
  context: BrowserContext,
  logger: VkAutomationLogger
): Promise<Page> {
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);
  logger.info("Page ready");
  return page;
}

export async function closeContext(context: BrowserContext): Promise<void> {
  await context.close();
}
