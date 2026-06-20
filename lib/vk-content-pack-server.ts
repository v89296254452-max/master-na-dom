import type { VkTask } from "./vk-task-types";
import {
  buildVkContentPack,
  buildVkVisualPrompts,
  resolveContentPack,
  type VkContentPackInput,
  type VkTaskContentPack,
} from "./vk-content-pack";
import { readVkContentTemplatesFile } from "./vk-content-templates";
import { readVkVisualTemplatesFile } from "./vk-visual-templates";

export function contentPackInputFromTask(task: VkTask): VkContentPackInput {
  return {
    accountGroup: task.accountGroup,
    city: task.city,
    service: task.service,
    phone: task.phone,
    siteUrl: task.siteUrl,
    vkName: task.vkName,
    vkFirstPost: task.vkFirstPost,
    slug: task.slug,
  };
}

export function generateVkContentPack(input: VkContentPackInput): VkTaskContentPack {
  return buildVkContentPack(input, readVkContentTemplatesFile(), readVkVisualTemplatesFile());
}

export function generateVkVisualPrompts(
  input: VkContentPackInput
): Pick<VkTaskContentPack, "avatarPrompt" | "coverPrompt"> {
  return buildVkVisualPrompts(input, readVkVisualTemplatesFile());
}

export function resolveContentPackFromFiles(
  raw: unknown,
  input: VkContentPackInput
): VkTaskContentPack {
  return resolveContentPack(raw, input, readVkContentTemplatesFile(), readVkVisualTemplatesFile());
}
