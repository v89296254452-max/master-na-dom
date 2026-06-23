/**
 * Проверка авторизации всех аккаунтов через Playwright.
 * Создаёт jobs auth_check и выполняет их синхронно.
 */

import fs from "fs";
import path from "path";
import { checkAuthForAccount } from "../lib/vk-automation/auth";
import { closeContext, closeSharedBrowser, openAccountContext } from "../lib/vk-automation/browser";
import {
  closeVkAutomationDb,
  createJob,
  listAccounts,
  completeJob,
} from "../lib/vk-automation/db";
import { createJobLogger } from "../lib/vk-automation/logger";

function loadEnvFile(filename: string): void {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

async function main(): Promise<void> {
  const accounts = listAccounts();
  console.log(`Checking ${accounts.length} accounts...`);

  for (const account of accounts) {
    const job = createJob({ accountId: account.id, action: "auth_check" });
    const logger = createJobLogger(job.id, account.id);
    const context = await openAccountContext(account, logger, { headless: true });

    try {
      const result = await checkAuthForAccount(context, account, job.id, logger);
      completeJob(
        job.id,
        result.loggedIn ? "success" : "failed",
        result,
        result.message
      );
      console.log(`${account.login}: ${result.loggedIn ? "OK" : "FAIL"} — ${result.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "error";
      completeJob(job.id, "failed", {}, message);
      console.log(`${account.login}: ERROR — ${message}`);
    } finally {
      await closeContext(context);
    }
  }

  await closeSharedBrowser();
  closeVkAutomationDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
