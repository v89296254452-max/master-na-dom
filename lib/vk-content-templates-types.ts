import type { VkAccountGroup } from "./vk-types";

export const VK_TEMPLATE_GROUP_LABELS = ["КП", "МнЧ", "БТ"] as const;

export type VkTemplateGroupLabel = (typeof VK_TEMPLATE_GROUP_LABELS)[number];

export interface VkGroupContentTemplates {
  descriptions: string[];
  pinnedPosts: string[];
  posts: string[];
}

export type VkContentTemplatesStore = Record<VkTemplateGroupLabel, VkGroupContentTemplates>;

export const ACCOUNT_GROUP_TO_TEMPLATE_LABEL: Record<VkAccountGroup, VkTemplateGroupLabel> = {
  kp: "КП",
  mnch: "МнЧ",
  bt: "БТ",
};

export const TEMPLATE_LABEL_TO_ACCOUNT_GROUP: Record<VkTemplateGroupLabel, VkAccountGroup> = {
  КП: "kp",
  МнЧ: "mnch",
  БТ: "bt",
};

export interface VkTemplateVariables {
  city: string;
  service: string;
  phone: string;
  siteUrl: string;
  vkName: string;
}

export const VK_TEMPLATE_VARIABLES = [
  "{{city}}",
  "{{service}}",
  "{{phone}}",
  "{{siteUrl}}",
  "{{vkName}}",
] as const;
