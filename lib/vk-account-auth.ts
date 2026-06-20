import type { VkAccount, VkAccountAuthStatus } from "./vk-account-types";
import { VK_ACCOUNT_AUTH_STATUSES } from "./vk-account-types";

export function isVkAccountAuthStatus(value: unknown): value is VkAccountAuthStatus {
  return typeof value === "string" && VK_ACCOUNT_AUTH_STATUSES.includes(value as VkAccountAuthStatus);
}

export function hasAccountAuthCredentials(account: Pick<VkAccount, "accessToken" | "vkUserId">): boolean {
  return account.accessToken.trim().length > 0 && account.vkUserId.trim().length > 0;
}

export function isAccountEligibleForAssignment(account: VkAccount): boolean {
  return account.status === "active" && account.authStatus === "connected";
}

export function buildVkProfileUrl(vkUserId: string): string {
  const id = vkUserId.trim();
  if (!id) return "";
  return `https://vk.com/id${id}`;
}

export function saveAccountAuthFields(
  account: VkAccount,
  accessToken: string,
  vkUserId: string
): VkAccount {
  const trimmedToken = accessToken.trim();
  const trimmedUserId = vkUserId.trim();

  return {
    ...account,
    accessToken: trimmedToken,
    vkUserId: trimmedUserId,
    vkProfileUrl: buildVkProfileUrl(trimmedUserId),
    authStatus: "connected",
    lastAuthError: "",
  };
}

export function checkAccountAuthTechnical(account: VkAccount): VkAccount {
  const now = new Date().toISOString();

  if (hasAccountAuthCredentials(account)) {
    return {
      ...account,
      authStatus: "connected",
      lastAuthCheckAt: now,
      lastAuthError: "",
    };
  }

  return {
    ...account,
    authStatus: "not_connected",
    lastAuthCheckAt: now,
    lastAuthError: "Не указан accessToken или vkUserId",
  };
}

export interface VkDashboardAuthStats {
  total: number;
  connected: number;
  not_connected: number;
  expired: number;
  error: number;
}

export function computeAuthStats(accounts: VkAccount[]): VkDashboardAuthStats {
  const stats: VkDashboardAuthStats = {
    total: accounts.length,
    connected: 0,
    not_connected: 0,
    expired: 0,
    error: 0,
  };

  for (const account of accounts) {
    stats[account.authStatus] += 1;
  }

  return stats;
}
