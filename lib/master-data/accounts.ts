import { listAccounts as listBrowserAccounts, getAccountById } from "@/lib/vk-automation/db";
import { readVkAccountsFile } from "@/lib/vk-accounts";
import type { VkAccount } from "@/lib/vk-account-types";
import { readVkTasksFile } from "@/lib/vk-tasks";
import type { VkAccountGroup } from "@/lib/vk-types";
import type { VkBrowserAccount } from "@/lib/vk-automation/types";
import {
  readAccountMergeFile,
  isMergeEntryLinked,
  getAccountMergePath,
} from "./account-merge";
import type {
  MasterAccount,
  MasterDataSource,
  ResolvedBrowserAccount,
  VkAccountMergeEntry,
} from "./types";
import { getMasterDataSource } from "./source";

export function getBrowserAccountMergeError(apiAccountId: string): string {
  return `Для аккаунта ${apiAccountId} не привязан browser account. Заполните data/vk-account-merge.json`;
}

export function getVkApiAccounts(): VkAccount[] {
  return readVkAccountsFile();
}

export function getBrowserAccounts(): VkBrowserAccount[] {
  return listBrowserAccounts();
}

export function getAccountMergeMap(): Map<string, VkAccountMergeEntry> {
  const map = new Map<string, VkAccountMergeEntry>();
  for (const entry of readAccountMergeFile()) {
    map.set(entry.apiAccountId, entry);
  }
  return map;
}

export function resolveBrowserAccount(apiAccountId: string): ResolvedBrowserAccount | null {
  const normalizedId = apiAccountId.trim();
  if (!normalizedId) return null;

  const merge = getAccountMergeMap().get(normalizedId);
  if (!merge || !isMergeEntryLinked(merge)) {
    return null;
  }

  const browserAccountId = merge.browserAccountId!;
  const browser = getAccountById(browserAccountId);
  if (!browser) {
    return null;
  }

  return {
    apiAccountId: normalizedId,
    browserAccountId,
    login: browser.login,
    password: browser.password,
    proxy: merge.proxy || browser.proxy,
    storageStatePath: browser.sessionPath,
    profileDir: browser.profilePath,
    status: merge.status || browser.status,
  };
}

function collectOfferGroups(accountId: string): VkAccountGroup[] {
  const tasks = readVkTasksFile();
  return [...new Set(
    tasks
      .filter((t) => t.assignedAccount === accountId)
      .map((t) => t.accountGroup)
  )] as VkAccountGroup[];
}

function mapApiAccountToMaster(account: VkAccount, resolved: ResolvedBrowserAccount | null): MasterAccount {
  return {
    id: account.id,
    login: resolved?.login ?? "",
    password: resolved?.password ?? "",
    proxy: resolved?.proxy ?? "",
    phone: account.phone,
    name: account.name,
    status: account.status,
    authStatus: resolved
      ? (getAccountById(resolved.browserAccountId)?.authStatus ?? account.authStatus)
      : account.authStatus,
    offerGroups: collectOfferGroups(account.id),
    source: "project",
  };
}

function mapLegacyAccount(row: VkBrowserAccount): MasterAccount {
  return {
    id: row.id,
    login: row.login,
    password: row.password,
    proxy: row.proxy,
    phone: row.login,
    name: row.login,
    status: row.status,
    authStatus: row.authStatus,
    offerGroups: [],
    source: "legacy",
  };
}

export function getVkAccountsFromApiAutomation(): MasterAccount[] {
  return getVkApiAccounts().map((account) =>
    mapApiAccountToMaster(account, resolveBrowserAccount(account.id))
  );
}

export function getLegacyVkAccounts(): MasterAccount[] {
  return getBrowserAccounts().map(mapLegacyAccount);
}

export function getMasterAccounts(source?: MasterDataSource): MasterAccount[] {
  const mode = source ?? getMasterDataSource();
  if (mode === "legacy") {
    return getLegacyVkAccounts();
  }
  return getVkAccountsFromApiAutomation();
}

export function getMasterAccountById(accountId: string, source?: MasterDataSource): MasterAccount | null {
  return getMasterAccounts(source).find((a) => a.id === accountId) ?? null;
}

export function getAccountMergeRows(): Array<{
  apiAccountId: string;
  apiName: string;
  apiPhone: string;
  apiStatus: string;
  browserAccountId: string | null;
  browserLogin: string;
  proxy: string;
  authStatus: string;
  linked: boolean;
  mergePath: string;
}> {
  const apiAccounts = getVkApiAccounts();
  const mergeMap = getAccountMergeMap();
  const mergePath = getAccountMergePath();

  return apiAccounts.map((api) => {
    const merge = mergeMap.get(api.id);
    const resolved = resolveBrowserAccount(api.id);
    const browser = resolved ? getAccountById(resolved.browserAccountId) : null;

    return {
      apiAccountId: api.id,
      apiName: api.name,
      apiPhone: api.phone,
      apiStatus: api.status,
      browserAccountId: merge?.browserAccountId ?? null,
      browserLogin: browser?.login ?? merge?.login ?? "",
      proxy: resolved?.proxy ?? merge?.proxy ?? "",
      authStatus: browser?.authStatus ?? "not_connected",
      linked: Boolean(resolved),
      mergePath,
    };
  });
}
