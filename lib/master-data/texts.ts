import { readVkContentTemplatesFile } from "@/lib/vk-content-templates";
import { ACCOUNT_GROUP_TO_TEMPLATE_LABEL } from "@/lib/vk-content-templates-types";
import type { VkTask } from "@/lib/vk-task-types";
import type { VkAccountGroup } from "@/lib/vk-types";
import type { MasterVkTexts } from "./types";

export function getVkTextsFromTask(task: VkTask): MasterVkTexts {
  const posts = [
    task.contentPack?.post2 ?? "",
    task.contentPack?.post3 ?? "",
    task.contentPack?.post4 ?? "",
    task.contentPack?.post5 ?? "",
  ].filter(Boolean);

  return {
    groupDescription: task.vkDescription,
    groupStatus: task.vkStatus,
    pinnedPost: task.vkFirstPost,
    posts,
    keywords: task.vkKeywords,
    contentPack: task.contentPack,
  };
}

export function getVkTextsFromTemplates(offerGroup: VkAccountGroup): {
  descriptions: string[];
  pinnedPosts: string[];
  posts: string[];
} {
  const store = readVkContentTemplatesFile();
  const label = ACCOUNT_GROUP_TO_TEMPLATE_LABEL[offerGroup];
  const group = store[label];
  return {
    descriptions: group?.descriptions ?? [],
    pinnedPosts: group?.pinnedPosts ?? [],
    posts: group?.posts ?? [],
  };
}

export function getVkTexts(task?: VkTask): MasterVkTexts | null {
  if (!task) return null;
  return getVkTextsFromTask(task);
}

/** Заглушка для будущего импорта текстов из Дзен-модуля */
export function getDzenTextsPlaceholder(): null {
  return null;
}
