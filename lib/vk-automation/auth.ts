import type { BrowserContext, Page } from "playwright";
import { VK_AUTOMATION_CONFIG } from "./config";
import { delay, safeScreenshot, saveAccountStorageState } from "./browser";
import type { VkAutomationLogger } from "./logger";
import { updateAccountAuth } from "./db";
import type { VkBrowserAccount } from "./types";

const LOGIN_INDICATORS = [
  '[data-testid="left_menu"]',
  ".left_menu",
  "#top_profile_link",
  '[data-testid="header-profile-link"]',
  ".TopNavBtn__profileLink",
  "a[href*='/feed']",
];

const LOGOUT_INDICATORS = [
  'input[name="login"]',
  'input[type="email"]',
  "#index_email",
  '[data-testid="login_field"]',
  "button:has-text('Войти')",
  "a:has-text('Войти')",
];

export async function navigateToVk(page: Page, logger: VkAutomationLogger): Promise<void> {
  logger.info(`Navigate to ${VK_AUTOMATION_CONFIG.vkLoginUrl}`);
  await page.goto(VK_AUTOMATION_CONFIG.vkLoginUrl, { waitUntil: "domcontentloaded" });
  await delay();
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  for (const selector of LOGIN_INDICATORS) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      return true;
    }
  }

  const logoutVisible = await page
    .locator(LOGOUT_INDICATORS.join(","))
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);

  return !logoutVisible && page.url().includes("vk.com") && !page.url().includes("login");
}

export async function waitForManualLogin(
  page: Page,
  logger: VkAutomationLogger,
  timeoutMs = VK_AUTOMATION_CONFIG.authManualTimeoutMs
): Promise<boolean> {
  logger.info(`Waiting for manual login (timeout ${timeoutMs}ms)`);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isLoggedIn(page)) {
      logger.info("Manual login detected");
      return true;
    }
    await delay(2000);
  }

  logger.warn("Manual login timeout");
  return false;
}

export async function openAuthForAccount(
  context: BrowserContext,
  account: VkBrowserAccount,
  jobId: string,
  logger: VkAutomationLogger
): Promise<{ success: boolean; message: string }> {
  const page = context.pages()[0] ?? await context.newPage();

  updateAccountAuth(account.id, "manual_pending", "");

  await navigateToVk(page, logger);

  if (await isLoggedIn(page)) {
    await saveAccountStorageState(context, account, logger);
    updateAccountAuth(account.id, "connected", "");
    return { success: true, message: "Уже авторизован" };
  }

  const loggedIn = await waitForManualLogin(page, logger);
  if (!loggedIn) {
    const screenshot = await safeScreenshot(page, account.id, jobId, "auth_timeout");
    updateAccountAuth(account.id, "error", "Таймаут ручной авторизации");
    return { success: false, message: `Таймаут. Скриншот: ${screenshot}` };
  }

  await saveAccountStorageState(context, account, logger);
  updateAccountAuth(account.id, "connected", "");
  return { success: true, message: "Авторизация сохранена" };
}

export async function checkAuthForAccount(
  context: BrowserContext,
  account: VkBrowserAccount,
  jobId: string,
  logger: VkAutomationLogger
): Promise<{ success: boolean; message: string; loggedIn: boolean }> {
  const page = context.pages()[0] ?? await context.newPage();
  await navigateToVk(page, logger);

  const loggedIn = await isLoggedIn(page);

  if (loggedIn) {
    await saveAccountStorageState(context, account, logger);
    updateAccountAuth(account.id, "connected", "");
    logger.info("Auth check: logged in");
    return { success: true, message: "Аккаунт авторизован", loggedIn: true };
  }

  const screenshot = await safeScreenshot(page, account.id, jobId, "auth_check_failed");
  updateAccountAuth(account.id, "not_connected", "Не авторизован");
  logger.warn("Auth check: not logged in");
  return {
    success: false,
    message: `Не авторизован. Скриншот: ${screenshot}`,
    loggedIn: false,
  };
}
