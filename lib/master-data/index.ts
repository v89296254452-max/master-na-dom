import type { MasterDataSourcesReport } from "./types";

export function getMasterDataSourcesReport(): MasterDataSourcesReport {
  return {
    accounts: "data/vk-accounts.json + data/vk-account-merge.json (browser: data/vk-automation/vk-automation.db)",
    cities: "data/pages.csv (SEO) · lib/pages.ts",
    services: "data/pages.csv · lib/service-templates.ts · lib/vk-generator.ts (offer mapping)",
    landingPages: "data/pages.csv · lib/pages.ts · lib/site.ts (NEXT_PUBLIC_SITE_URL)",
    phones: "data/pages.csv · data/vk-tasks.json",
    texts: "data/vk-tasks.json · data/vk-content-templates.json · lib/vk-content-pack.ts",
    offers: "lib/vk-types.ts (kp/mnch/bt) · lib/vk-content-templates-types.ts",
    vkTasks: "data/vk-tasks.json · data/vk-plan.csv · lib/vk-tasks.ts",
  };
}

export * from "./types";
export { getMasterDataSource, setMasterDataSource, getActiveSourceLabel } from "./source";
export {
  getVkApiAccounts,
  getBrowserAccounts,
  getAccountMergeMap,
  resolveBrowserAccount,
  getBrowserAccountMergeError,
  getAccountMergeRows,
  getVkAccountsFromApiAutomation,
  getLegacyVkAccounts,
  getMasterAccounts,
  getMasterAccountById,
} from "./accounts";
export { readAccountMergeFile, writeAccountMergeFile, getAccountMergePath } from "./account-merge";
export { getSeoCities, getLegacyCities, getMasterCities } from "./cities";
export { getSeoServices, getLegacyServices, getMasterServices } from "./services";
export { getMasterOffers, getOfferLabel, MASTER_OFFERS, isVkAccountGroup } from "./offers";
export { getLandingPages, getLandingPageBySlug } from "./landing-pages";
export { getPhones, getPhonesFromSeo, getPhonesFromVkTasks } from "./phones";
export {
  getVkTexts,
  getVkTextsFromTask,
  getVkTextsFromTemplates,
  getDzenTextsPlaceholder,
} from "./texts";
export {
  buildVkGroupTask,
  buildAndEnqueueGroupTasks,
  isOfferCombinationTaken,
  isGroupAlreadyCreated,
  taskOfferKey,
  type BuildVkGroupTaskResult,
} from "./build-task";
