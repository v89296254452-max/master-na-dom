import type { VkAccountGroup } from "@/lib/vk-types";

export type MasterDataSource = "project" | "legacy";

export const MASTER_DATA_SOURCES: MasterDataSource[] = ["project", "legacy"];

export const MASTER_DATA_SOURCE_LABELS: Record<MasterDataSource, string> = {
  project: "SEO + VK API automation",
  legacy: "Legacy ZennoPoster DB",
};

export interface VkGroupCreationPost {
  text: string;
  imagePath?: string;
}

export interface VkAccountMergeEntry {
  apiAccountId: string;
  browserAccountId: string | null;
  login: string;
  proxy: string;
  status: string;
  notes: string;
}

export interface ResolvedBrowserAccount {
  apiAccountId: string;
  browserAccountId: string;
  login: string;
  password: string;
  proxy: string;
  storageStatePath: string;
  profileDir: string;
  status: string;
}

export interface VkGroupCreationTask {
  taskId: string;
  /** VK API account id from vk-accounts.json (assignedAccount) */
  accountId: string;
  /** Browser worker account id from vk-automation.db */
  browserAccountId: string;
  proxy?: string;
  city: string;
  region?: string;
  service: string;
  offerGroup: VkAccountGroup;
  groupTitle: string;
  groupDescription: string;
  phone: string;
  landingUrl: string;
  posts: VkGroupCreationPost[];
  avatarPath?: string;
  coverPath?: string;
}

export interface MasterAccount {
  id: string;
  login: string;
  password: string;
  proxy: string;
  phone: string;
  name: string;
  status: string;
  authStatus: string;
  offerGroups: VkAccountGroup[];
  source: MasterDataSource;
}

export interface MasterCity {
  name: string;
  region?: string;
  slug?: string;
}

export interface MasterService {
  name: string;
  slug: string;
  offerGroup: VkAccountGroup;
}

export interface MasterOffer {
  id: VkAccountGroup;
  label: string;
  templateLabel: string;
}

export interface MasterLandingPage {
  slug: string;
  city: string;
  cityPrepositional: string;
  service: string;
  serviceSlug: string;
  phone: string;
  url: string;
  offerGroup: VkAccountGroup;
  title: string;
  description: string;
}

export interface MasterPhone {
  phone: string;
  normalized: string;
  city?: string;
  offerGroup?: VkAccountGroup;
}

export interface MasterVkTexts {
  groupDescription: string;
  groupStatus: string;
  pinnedPost: string;
  posts: string[];
  keywords: string;
  contentPack?: {
    pinnedPost: string;
    post2: string;
    post3: string;
    post4: string;
    post5: string;
  };
}

export interface BuildTasksResult {
  created: number;
  skipped: number;
  errors: string[];
  jobIds: string[];
}

export interface MasterDataSourcesReport {
  accounts: string;
  cities: string;
  services: string;
  landingPages: string;
  phones: string;
  texts: string;
  offers: string;
  vkTasks: string;
}
