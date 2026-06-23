import { resolveBrowserAccount } from "@/lib/master-data/accounts";
import { getAccountById, upsertAccount } from "./db";
import type { VkBrowserAccount } from "./types";

export function getWorkerBrowserAccount(apiAccountId: string): VkBrowserAccount | null {
  const resolved = resolveBrowserAccount(apiAccountId);
  if (!resolved) return null;

  const existing = getAccountById(resolved.browserAccountId);
  if (!existing) return null;

  if (resolved.proxy && resolved.proxy !== existing.proxy) {
    return upsertAccount({
      ...existing,
      proxy: resolved.proxy,
    });
  }

  return existing;
}

export function getLegacyBrowserAccount(accountId: string): VkBrowserAccount | null {
  return getAccountById(accountId) ?? null;
}
