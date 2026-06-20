import type { VkAccountGroup } from "./vk-types";
import type { VkTask } from "./vk-task-types";

export type VkDuplicateField =
  | "vkDescription"
  | "firstPost"
  | "pinnedPost"
  | "post2"
  | "post3"
  | "post4"
  | "post5"
  | "avatarPrompt"
  | "coverPrompt";

export const VK_DUPLICATE_FIELDS: VkDuplicateField[] = [
  "vkDescription",
  "firstPost",
  "pinnedPost",
  "post2",
  "post3",
  "post4",
  "post5",
  "avatarPrompt",
  "coverPrompt",
];

export const VK_DUPLICATE_FIELD_LABELS: Record<VkDuplicateField, string> = {
  vkDescription: "Описание VK",
  firstPost: "Первый пост",
  pinnedPost: "Закреплённый пост",
  post2: "Пост 2",
  post3: "Пост 3",
  post4: "Пост 4",
  post5: "Пост 5",
  avatarPrompt: "Промпт аватара",
  coverPrompt: "Промпт обложки",
};

export type VkDuplicateKind = "exact" | "similar";

export interface VkDuplicateIssue {
  field: VkDuplicateField;
  taskId1: string;
  taskId2: string;
  group1: VkAccountGroup;
  group2: VkAccountGroup;
  city1: string;
  city2: string;
  service1: string;
  service2: string;
  similarityPercent: number;
  kind: VkDuplicateKind;
}

export interface VkDuplicateCheckResult {
  totalChecked: number;
  exactCount: number;
  similarCount: number;
  issues: VkDuplicateIssue[];
  affectedTaskIds: string[];
  cleanTaskCount: number;
}

export const VK_DUPLICATE_SIMILARITY_THRESHOLD = 80;
