import type { VkTemplateGroupLabel } from "./vk-content-templates-types";
import { VK_TEMPLATE_GROUP_LABELS } from "./vk-content-templates-types";

export interface VkGroupVisualTemplates {
  avatarPrompts: string[];
  coverPrompts: string[];
}

export type VkVisualTemplatesStore = Record<VkTemplateGroupLabel, VkGroupVisualTemplates>;

export const VK_VISUAL_TEMPLATE_SECTIONS = ["avatarPrompts", "coverPrompts"] as const;

export type VkVisualTemplateSection = (typeof VK_VISUAL_TEMPLATE_SECTIONS)[number];

export const VK_VISUAL_TEMPLATE_SECTION_LABELS: Record<VkVisualTemplateSection, string> = {
  avatarPrompts: "Промпты для аватара (avatarPrompts)",
  coverPrompts: "Промпты для обложки (coverPrompts)",
};
