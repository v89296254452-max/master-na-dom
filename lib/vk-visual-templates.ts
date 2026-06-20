import fs from "fs";
import path from "path";
import { VK_TEMPLATE_GROUP_LABELS } from "./vk-content-templates-types";
import type {
  VkGroupVisualTemplates,
  VkVisualTemplatesStore,
} from "./vk-visual-templates-types";

const VK_VISUAL_TEMPLATES_PATH = path.join(process.cwd(), "data", "vk-visual-templates.json");

function emptyGroupVisualTemplates(): VkGroupVisualTemplates {
  return { avatarPrompts: [], coverPrompts: [] };
}

export function createDefaultVkVisualTemplates(): VkVisualTemplatesStore {
  return {
    КП: {
      avatarPrompts: [
        "Квадратный аватар VK для «{{vkName}}». Тематика: компьютерная помощь, {{city}}. Ноутбук, монитор, синие акценты. Минимализм, без мелкого текста.",
        "Аватар сообщества «{{service}} {{city}}». Иконка ПК и мастер, современный плоский стиль, читаемо на мобильном.",
        "Логотип VK «{{vkName}}»: компьютер, клавиатура, {{city}}. Светлый фон, оранжево-синие акценты.",
        "Круглый аватар для {{service}} в {{city}}. Диагностика ПК, чистый дизайн, без водяных знаков.",
        "Аватар VK «{{vkName}}». Выездная компьютерная помощь, {{city}}. Простая графика, контрастные цвета.",
      ],
      coverPrompts: [
        "Обложка VK 1590×400 «{{service}} — {{city}}». Компьютерная помощь на дому. Тел: {{phone}}. Сайт: {{siteUrl}}",
        "Широкий баннер «{{vkName}}»: настройка ПК, удаление вирусов, {{city}}. Крупный заголовок, контакт {{phone}}.",
        "Обложка сообщества {{service}} {{city}}. Мастер за ноутбуком, синий градиент, телефон {{phone}}.",
        "VK cover «{{vkName}}». {{city}} — компьютерная помощь. Минимум деталей, CTA: {{siteUrl}}",
        "Обложка 1590×400: {{service}} в {{city}}. Выезд мастера, гарантия. {{phone}} | {{siteUrl}}",
      ],
    },
    МнЧ: {
      avatarPrompts: [
        "Квадратный аватар VK «{{vkName}}». Мастер на час, {{city}}. Инструменты, домашний ремонт, тёплые цвета.",
        "Аватар «{{service}} {{city}}». Молоток, ключ, аккуратный плоский стиль, без мелкого текста.",
        "Логотип VK для {{service}} в {{city}}. Мастер на выезде, зелёно-оранжевые акценты.",
        "Круглый аватар «{{vkName}}». Домашний ремонт, {{city}}. Простая иконка, читаемо на телефоне.",
        "Аватар сообщества {{service}} — {{city}}. Сантехника и электрика, современный минимализм.",
      ],
      coverPrompts: [
        "Обложка VK 1590×400 «{{service}} — {{city}}». Мастер на час, выезд на дом. {{phone}} | {{siteUrl}}",
        "Баннер «{{vkName}}»: домашний ремонт в {{city}}. Крупный текст, контакт {{phone}}.",
        "Обложка {{service}} {{city}}. Мастер с инструментом, светлый фон, телефон {{phone}}.",
        "VK cover «{{vkName}}». {{city}} — мелкий ремонт и сборка. CTA: {{siteUrl}}",
        "Обложка 1590×400: {{service}} в {{city}}. Удобное время выезда. {{phone}} — {{siteUrl}}",
      ],
    },
    БТ: {
      avatarPrompts: [
        "Квадратный аватар VK «{{vkName}}». Ремонт бытовой техники, {{city}}. Холодильник, стиральная машина, синие акценты.",
        "Аватар «{{service}} {{city}}». Мастер с инструментом у техники, плоский стиль, без мелкого текста.",
        "Логотип VK для {{service}} в {{city}}. Бытовая техника, современная графика, контрастные цвета.",
        "Круглый аватар «{{vkName}}». Выездной ремонт техники, {{city}}. Минималистичная иконка.",
        "Аватар сообщества {{service}} — {{city}}. Диагностика техники на дому, чистый дизайн.",
      ],
      coverPrompts: [
        "Обложка VK 1590×400 «{{service}} — {{city}}». Ремонт бытовой техники на дому. {{phone}} | {{siteUrl}}",
        "Баннер «{{vkName}}»: ремонт холодильников и стиральных машин, {{city}}. Тел: {{phone}}.",
        "Обложка {{service}} {{city}}. Мастер у техники, светлый фон, контакт {{phone}}.",
        "VK cover «{{vkName}}». {{city}} — срочный выезд мастера. Сайт: {{siteUrl}}",
        "Обложка 1590×400: {{service}} в {{city}}. Гарантия на работы. {{phone}} — {{siteUrl}}",
      ],
    },
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeGroupVisualTemplates(raw: unknown): VkGroupVisualTemplates {
  if (!raw || typeof raw !== "object") {
    return emptyGroupVisualTemplates();
  }

  const source = raw as Partial<VkGroupVisualTemplates>;
  return {
    avatarPrompts: normalizeStringList(source.avatarPrompts),
    coverPrompts: normalizeStringList(source.coverPrompts),
  };
}

export function normalizeVkVisualTemplates(raw: unknown): VkVisualTemplatesStore {
  const defaults = createDefaultVkVisualTemplates();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const source = raw as Partial<VkVisualTemplatesStore>;
  const result = { ...defaults };

  for (const label of VK_TEMPLATE_GROUP_LABELS) {
    result[label] = normalizeGroupVisualTemplates(source[label]);
    if (result[label].avatarPrompts.length === 0 && result[label].coverPrompts.length === 0) {
      result[label] = defaults[label];
    }
  }

  return result;
}

export function readVkVisualTemplatesFile(): VkVisualTemplatesStore {
  if (!fs.existsSync(VK_VISUAL_TEMPLATES_PATH)) {
    return createDefaultVkVisualTemplates();
  }

  const content = fs.readFileSync(VK_VISUAL_TEMPLATES_PATH, "utf-8");
  const parsed = JSON.parse(content) as unknown;
  return normalizeVkVisualTemplates(parsed);
}

export function writeVkVisualTemplatesFile(templates: VkVisualTemplatesStore): void {
  fs.mkdirSync(path.dirname(VK_VISUAL_TEMPLATES_PATH), { recursive: true });
  fs.writeFileSync(VK_VISUAL_TEMPLATES_PATH, JSON.stringify(templates, null, 2) + "\n", "utf-8");
}

export function ensureVkVisualTemplatesFile(): VkVisualTemplatesStore {
  if (!fs.existsSync(VK_VISUAL_TEMPLATES_PATH)) {
    const defaults = createDefaultVkVisualTemplates();
    writeVkVisualTemplatesFile(defaults);
    return defaults;
  }

  return readVkVisualTemplatesFile();
}

export { applyTemplateVariables, pickTemplate } from "./vk-content-pack";
