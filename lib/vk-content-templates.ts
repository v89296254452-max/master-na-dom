import fs from "fs";
import path from "path";
import type {
  VkContentTemplatesStore,
  VkGroupContentTemplates,
  VkTemplateGroupLabel,
} from "./vk-content-templates-types";
import { VK_TEMPLATE_GROUP_LABELS } from "./vk-content-templates-types";

const VK_CONTENT_TEMPLATES_PATH = path.join(process.cwd(), "data", "vk-content-templates.json");

function emptyGroupTemplates(): VkGroupContentTemplates {
  return { descriptions: [], pinnedPosts: [], posts: [] };
}

export function createDefaultVkContentTemplates(): VkContentTemplatesStore {
  return {
    КП: {
      descriptions: [
        "{{vkName}}\n\n{{service}} в {{city}}.\nВыезд мастера на дом.\nТелефон: {{phone}}\nСайт: {{siteUrl}}",
        "Компьютерная помощь в {{city}} — {{service}}.\nДиагностика, настройка ПК, удаление вирусов.\nЗвоните: {{phone}}\n{{siteUrl}}",
        "{{service}} {{city}}: мастер приедет в удобное время.\nОфициальная работа, гарантия на услуги.\n{{phone}} | {{siteUrl}}",
        "Нужна {{service}} в {{city}}? Работаем ежедневно.\nБесплатная консультация по телефону.\n{{phone}}\nПодробнее: {{siteUrl}}",
        "{{vkName}} — выездной сервис по {{city}}.\nНастройка, ремонт, восстановление данных.\nТел: {{phone}}\nСайт: {{siteUrl}}",
      ],
      pinnedPosts: [
        "📌 {{service}} в {{city}}\n\nВыезд мастера на дом в течение 30–60 минут.\n• Диагностика\n• Настройка ПК\n• Удаление вирусов\n\nЗвоните: {{phone}}\nСайт: {{siteUrl}}",
        "💻 {{vkName}}\n\nПоможем с компьютером в {{city}} — быстро и с гарантией.\nОставьте заявку на сайте или звоните.\n\n{{phone}}\n{{siteUrl}}",
        "🔧 Компьютерная помощь — {{city}}\n\nРаботаем без выходных. Мастер приедет с инструментом.\n{{service}} на дому.\n\nТел: {{phone}}\n{{siteUrl}}",
        "✅ {{service}} в {{city}}\n\nЧестные цены, опытные мастера, удобное время выезда.\nПерезвоним за 15 минут.\n\n{{phone}}\n{{siteUrl}}",
        "📣 {{vkName}}\n\nНастройка Windows, удаление вирусов, восстановление файлов.\n{{city}} — выезд на дом.\n\n{{phone}} | {{siteUrl}}",
      ],
      posts: [
        "🔧 {{service}} в {{city}}: диагностика и настройка ПК\n\nРаботаем официально, даём гарантию.\nЗвоните: {{phone}}\n{{siteUrl}}",
        "✅ Почему выбирают нас в {{city}}?\n\n• Опытные мастера\n• Выезд в день обращения\n• Честные цены\n\n{{phone}} | {{siteUrl}}",
        "❓ Сколько стоит {{service}} в {{city}}?\n\nСтоимость зависит от задачи. Консультация по телефону.\n\n📞 {{phone}}\n🌐 {{siteUrl}}",
        "💡 Совет: не откладывайте ремонт ПК\n\nПроблемы с компьютером в {{city}}? Вызовите мастера на дом.\n{{phone}}\n{{siteUrl}}",
        "📣 {{service}} — {{city}}\n\nНужен мастер сегодня? Звоните или оставьте заявку.\n\n{{phone}}\n{{siteUrl}}",
      ],
    },
    МнЧ: {
      descriptions: [
        "{{vkName}}\n\n{{service}} в {{city}}.\nМастер на час и домашний ремонт.\nТелефон: {{phone}}\nСайт: {{siteUrl}}",
        "{{service}} {{city}} — выезд мастера на дом.\nСантехника, электрика, мелкий ремонт.\n{{phone}}\n{{siteUrl}}",
        "Мастер на дом в {{city}}: {{service}}.\nУдобное время, фиксированные цены.\nЗвоните: {{phone}}\n{{siteUrl}}",
        "{{vkName}}\n\nПоможем с бытовыми задачами в {{city}}.\n{{phone}} | {{siteUrl}}",
        "{{service}} в {{city}} — один звонок, мастер у вас.\nРаботаем по всему городу.\n{{phone}}\n{{siteUrl}}",
      ],
      pinnedPosts: [
        "📌 {{service}} в {{city}}\n\nМастер на час: ремонт, сборка, установка.\nВыезд в удобное время.\n\n{{phone}}\n{{siteUrl}}",
        "🔧 {{vkName}}\n\nДомашний ремонт в {{city}} — быстро и аккуратно.\nЗаявка на сайте или по телефону.\n\n{{phone}}\n{{siteUrl}}",
        "🏠 Мастер на дом — {{city}}\n\nСантехника, электрика, навеска полок.\n{{service}}\n\nТел: {{phone}}\n{{siteUrl}}",
        "✅ {{service}} в {{city}}\n\nОпытные мастера, гарантия на работы.\nПерезвоним в течение 15 минут.\n\n{{phone}}\n{{siteUrl}}",
        "📣 {{vkName}}\n\nМелкий ремонт и бытовые услуги в {{city}}.\n\n{{phone}} | {{siteUrl}}",
      ],
      posts: [
        "🔧 {{service}} в {{city}}: мелкий ремонт и сборка\n\nВыезд мастера с инструментом.\n{{phone}}\n{{siteUrl}}",
        "✅ Почему нас рекомендуют в {{city}}?\n\n• Быстрый выезд\n• Аккуратная работа\n• Понятные цены\n\n{{phone}} | {{siteUrl}}",
        "❓ Нужен мастер на час в {{city}}?\n\n{{service}} — звоните, подберём удобное время.\n\n📞 {{phone}}\n🌐 {{siteUrl}}",
        "💡 Установка техники и навеска — {{city}}\n\nМастер приедет в день обращения.\n{{phone}}\n{{siteUrl}}",
        "📣 {{service}} — {{city}}\n\nОставьте заявку на сайте.\n\n{{phone}}\n{{siteUrl}}",
      ],
    },
    БТ: {
      descriptions: [
        "{{vkName}}\n\n{{service}} в {{city}}.\nРемонт бытовой техники на дому.\nТелефон: {{phone}}\nСайт: {{siteUrl}}",
        "{{service}} {{city}} — выезд мастера, диагностика, гарантия.\n{{phone}}\n{{siteUrl}}",
        "Ремонт техники в {{city}}: {{service}}.\nОригинальные и аналоговые запчасти.\nЗвоните: {{phone}}\n{{siteUrl}}",
        "{{vkName}}\n\nСрочный ремонт в {{city}}.\n{{phone}} | {{siteUrl}}",
        "{{service}} на дому в {{city}}.\nМастер приедет с инструментом и расходниками.\n{{phone}}\n{{siteUrl}}",
      ],
      pinnedPosts: [
        "📌 {{service}} в {{city}}\n\nРемонт бытовой техники на дому.\nДиагностика, замена деталей, гарантия.\n\n{{phone}}\n{{siteUrl}}",
        "🔧 {{vkName}}\n\nСломалась техника в {{city}}? Вызовите мастера.\n{{service}}\n\n{{phone}}\n{{siteUrl}}",
        "🏠 Ремонт техники — {{city}}\n\nХолодильники, стиральные машины, плиты и другое.\n\nТел: {{phone}}\n{{siteUrl}}",
        "✅ {{service}} в {{city}}\n\nЧестная диагностика, запчасти в наличии.\n{{phone}}\n{{siteUrl}}",
        "📣 {{vkName}}\n\nВыезд мастера по {{city}}.\n\n{{phone}} | {{siteUrl}}",
      ],
      posts: [
        "🔧 {{service}} в {{city}}: диагностика на дому\n\nГарантия на выполненные работы.\n{{phone}}\n{{siteUrl}}",
        "✅ Почему выбирают нас в {{city}}?\n\n• Опыт с бытовой техникой\n• Запчасти под заказ\n• Удобное время выезда\n\n{{phone}} | {{siteUrl}}",
        "❓ Сколько стоит ремонт в {{city}}?\n\n{{service}} — цена после диагностики.\n\n📞 {{phone}}\n🌐 {{siteUrl}}",
        "💡 Не откладывайте ремонт техники\n\n{{service}} в {{city}} — мастер приедет сегодня.\n{{phone}}\n{{siteUrl}}",
        "📣 {{service}} — {{city}}\n\nЗаявка на сайте или по телефону.\n\n{{phone}}\n{{siteUrl}}",
      ],
    },
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeGroupTemplates(raw: unknown): VkGroupContentTemplates {
  if (!raw || typeof raw !== "object") {
    return emptyGroupTemplates();
  }

  const source = raw as Partial<VkGroupContentTemplates>;
  return {
    descriptions: normalizeStringList(source.descriptions),
    pinnedPosts: normalizeStringList(source.pinnedPosts),
    posts: normalizeStringList(source.posts),
  };
}

export function normalizeVkContentTemplates(raw: unknown): VkContentTemplatesStore {
  const defaults = createDefaultVkContentTemplates();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const source = raw as Partial<VkContentTemplatesStore>;
  const result = { ...defaults };

  for (const label of VK_TEMPLATE_GROUP_LABELS) {
    result[label] = normalizeGroupTemplates(source[label]);
    if (
      result[label].descriptions.length === 0 &&
      result[label].pinnedPosts.length === 0 &&
      result[label].posts.length === 0
    ) {
      result[label] = defaults[label];
    }
  }

  return result;
}

export function readVkContentTemplatesFile(): VkContentTemplatesStore {
  if (!fs.existsSync(VK_CONTENT_TEMPLATES_PATH)) {
    return createDefaultVkContentTemplates();
  }

  const content = fs.readFileSync(VK_CONTENT_TEMPLATES_PATH, "utf-8");
  const parsed = JSON.parse(content) as unknown;
  return normalizeVkContentTemplates(parsed);
}

export function writeVkContentTemplatesFile(templates: VkContentTemplatesStore): void {
  fs.mkdirSync(path.dirname(VK_CONTENT_TEMPLATES_PATH), { recursive: true });
  fs.writeFileSync(VK_CONTENT_TEMPLATES_PATH, JSON.stringify(templates, null, 2) + "\n", "utf-8");
}

export function ensureVkContentTemplatesFile(): VkContentTemplatesStore {
  if (!fs.existsSync(VK_CONTENT_TEMPLATES_PATH)) {
    const defaults = createDefaultVkContentTemplates();
    writeVkContentTemplatesFile(defaults);
    return defaults;
  }

  return readVkContentTemplatesFile();
}

export {
  applyTemplateVariables,
  pickTemplate,
  pickTemplateIndex,
} from "./vk-content-pack";
