import type { VkAccountGroup } from "./vk-types";
import type { VkContentTemplatesStore, VkTemplateVariables } from "./vk-content-templates-types";
import { ACCOUNT_GROUP_TO_TEMPLATE_LABEL } from "./vk-content-templates-types";
import type { VkVisualTemplatesStore } from "./vk-visual-templates-types";

export interface VkTaskContentPack {
  avatarPrompt: string;
  coverPrompt: string;
  pinnedPost: string;
  post2: string;
  post3: string;
  post4: string;
  post5: string;
}

export const VK_CONTENT_PACK_KEYS: (keyof VkTaskContentPack)[] = [
  "avatarPrompt",
  "coverPrompt",
  "pinnedPost",
  "post2",
  "post3",
  "post4",
  "post5",
];

export const VK_CONTENT_PACK_LABELS: Record<keyof VkTaskContentPack, string> = {
  avatarPrompt: "Промпт для аватара",
  coverPrompt: "Промпт для обложки",
  pinnedPost: "Закреплённый пост",
  post2: "Пост 2",
  post3: "Пост 3",
  post4: "Пост 4",
  post5: "Пост 5",
};

export const DEFAULT_CONTENT_PACK: VkTaskContentPack = {
  avatarPrompt: "",
  coverPrompt: "",
  pinnedPost: "",
  post2: "",
  post3: "",
  post4: "",
  post5: "",
};

export interface VkContentPackInput {
  accountGroup: VkAccountGroup;
  city: string;
  service: string;
  phone: string;
  siteUrl: string;
  vkName: string;
  vkFirstPost: string;
  slug?: string;
}

const GROUP_COPY: Record<VkAccountGroup, { label: string; visual: string }> = {
  kp: {
    label: "компьютерная помощь",
    visual: "компьютер, ноутбук, мастер за рабочим столом",
  },
  mnch: {
    label: "мастер на час",
    visual: "инструменты, домашний ремонт, мастер на выезде",
  },
  bt: {
    label: "ремонт бытовой техники",
    visual: "холодильник, стиральная машина, мастер с инструментом",
  },
};

export function normalizeContentPack(raw: unknown): VkTaskContentPack {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CONTENT_PACK };
  }

  const source = raw as Partial<VkTaskContentPack>;
  const result = { ...DEFAULT_CONTENT_PACK };

  for (const key of VK_CONTENT_PACK_KEYS) {
    if (typeof source[key] === "string") {
      result[key] = source[key];
    }
  }

  return result;
}

export function hasContentPackData(pack: VkTaskContentPack): boolean {
  return VK_CONTENT_PACK_KEYS.some((key) => pack[key].trim().length > 0);
}

export function applyTemplateVariables(template: string, vars: VkTemplateVariables): string {
  return template
    .replace(/\{\{city\}\}/g, vars.city)
    .replace(/\{\{service\}\}/g, vars.service)
    .replace(/\{\{phone\}\}/g, vars.phone)
    .replace(/\{\{siteUrl\}\}/g, vars.siteUrl)
    .replace(/\{\{vkName\}\}/g, vars.vkName);
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickTemplateIndex(seed: string, length: number, offset = 0): number {
  if (length <= 0) return 0;
  return (hashSeed(`${seed}:${offset}`) % length + length) % length;
}

export function pickTemplate(templates: string[], seed: string, offset = 0): string {
  if (templates.length === 0) return "";
  return templates[pickTemplateIndex(seed, templates.length, offset)] ?? templates[0];
}

function buildTemplateVars(input: VkContentPackInput): VkTemplateVariables {
  return {
    city: input.city,
    service: input.service,
    phone: input.phone,
    siteUrl: input.siteUrl,
    vkName: input.vkName,
  };
}

function buildFallbackVisualPrompts(
  input: VkContentPackInput
): Pick<VkTaskContentPack, "avatarPrompt" | "coverPrompt"> {
  const group = GROUP_COPY[input.accountGroup];
  const { vkName, service, city, phone } = input;

  const avatarPrompt = [
    `Квадратный аватар для VK-сообщества «${vkName}».`,
    `Тематика: ${group.label}, ${group.visual}.`,
    "Стиль: чистый, современный, читаемый на мобильном.",
    `Акцент: ${service} в ${city}.`,
    "Без мелкого текста, без водяных знаков.",
  ].join(" ");

  const coverPrompt = [
    `Обложка VK 1590×400 для «${vkName}».`,
    `Тематика: ${group.label}, ${group.visual}.`,
    `Крупный текст: «${service} — ${city}».`,
    `Контакт: ${phone}.`,
    "Светлый фон, контрастные акценты, без перегруза деталями.",
  ].join(" ");

  return { avatarPrompt, coverPrompt };
}

export function buildVkVisualPrompts(
  input: VkContentPackInput,
  visualTemplates?: VkVisualTemplatesStore
): Pick<VkTaskContentPack, "avatarPrompt" | "coverPrompt"> {
  if (!visualTemplates) {
    return buildFallbackVisualPrompts(input);
  }

  const label = ACCOUNT_GROUP_TO_TEMPLATE_LABEL[input.accountGroup];
  const groupVisuals = visualTemplates[label];
  const vars = buildTemplateVars(input);
  const seed = input.slug || input.vkName || input.city;

  const hasVisualTemplates =
    groupVisuals.avatarPrompts.length > 0 || groupVisuals.coverPrompts.length > 0;

  if (!hasVisualTemplates) {
    return buildFallbackVisualPrompts(input);
  }

  const avatarTemplate = pickTemplate(groupVisuals.avatarPrompts, seed, 0);
  const coverTemplate = pickTemplate(groupVisuals.coverPrompts, seed, 1);

  return {
    avatarPrompt: applyTemplateVariables(avatarTemplate, vars),
    coverPrompt: applyTemplateVariables(coverTemplate, vars),
  };
}

export function buildContentPackFromTemplates(
  input: VkContentPackInput,
  templates: VkContentTemplatesStore,
  visualTemplates?: VkVisualTemplatesStore
): VkTaskContentPack {
  const label = ACCOUNT_GROUP_TO_TEMPLATE_LABEL[input.accountGroup];
  const groupTemplates = templates[label];
  const vars = buildTemplateVars(input);
  const seed = input.slug || input.vkName || input.city;

  const { avatarPrompt, coverPrompt } = buildVkVisualPrompts(input, visualTemplates);

  const pinnedTemplate = pickTemplate(groupTemplates.pinnedPosts, seed, 1);
  let pinnedPost = applyTemplateVariables(pinnedTemplate, vars);
  if (!pinnedPost.trim() && input.vkFirstPost.trim()) {
    pinnedPost = input.vkFirstPost.trim();
  }

  const post2 = applyTemplateVariables(pickTemplate(groupTemplates.posts, seed, 2), vars);
  const post3 = applyTemplateVariables(pickTemplate(groupTemplates.posts, seed, 3), vars);
  const post4 = applyTemplateVariables(pickTemplate(groupTemplates.posts, seed, 4), vars);
  const post5 = applyTemplateVariables(pickTemplate(groupTemplates.posts, seed, 5), vars);

  return {
    avatarPrompt,
    coverPrompt,
    pinnedPost,
    post2,
    post3,
    post4,
    post5,
  };
}

export function buildFallbackContentPack(input: VkContentPackInput): VkTaskContentPack {
  const group = GROUP_COPY[input.accountGroup];
  const { city, service, phone, siteUrl, vkName, vkFirstPost } = input;

  const pinnedPost =
    vkFirstPost.trim() ||
    [
      `📌 ${service} в ${city}`,
      "",
      `Выезд мастера на дом. ${group.label}.`,
      `Телефон: ${phone}`,
      `Сайт: ${siteUrl}`,
    ].join("\n");

  const { avatarPrompt, coverPrompt } = buildVkVisualPrompts(input);

  return {
    avatarPrompt,
    coverPrompt,
    pinnedPost,
    post2: `🔧 ${service} в ${city}\n\nЗвоните: ${phone}\n${siteUrl}`,
    post3: `✅ ${service} — ${city}\n\n${phone} | ${siteUrl}`,
    post4: `❓ Вопросы по ${service} в ${city}?\n\n${phone}\n${siteUrl}`,
    post5: `📣 ${vkName}\n\n${phone}\n${siteUrl}`,
  };
}

export function buildVkContentPack(
  input: VkContentPackInput,
  templates: VkContentTemplatesStore,
  visualTemplates?: VkVisualTemplatesStore
): VkTaskContentPack {
  const label = ACCOUNT_GROUP_TO_TEMPLATE_LABEL[input.accountGroup];
  const groupTemplates = templates[label];

  const hasTemplates =
    groupTemplates.descriptions.length > 0 ||
    groupTemplates.pinnedPosts.length > 0 ||
    groupTemplates.posts.length > 0;

  if (hasTemplates) {
    return buildContentPackFromTemplates(input, templates, visualTemplates);
  }

  return buildFallbackContentPack(input);
}

export function resolveContentPack(
  raw: unknown,
  input: VkContentPackInput,
  templates?: VkContentTemplatesStore,
  visualTemplates?: VkVisualTemplatesStore
): VkTaskContentPack {
  const normalized = normalizeContentPack(raw);
  if (hasContentPackData(normalized)) {
    return normalized;
  }

  if (templates) {
    return buildVkContentPack(input, templates, visualTemplates);
  }

  return buildFallbackContentPack(input);
}
