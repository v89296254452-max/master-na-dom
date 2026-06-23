import type { VkTask } from "./vk-task-types";
import type { VkAccountGroup } from "./vk-types";

interface GroupImageTheme {
  short: string;
  label: string;
  visual: string;
  postAngles: [string, string, string];
}

const GROUP_IMAGE_THEMES: Record<VkAccountGroup, GroupImageTheme> = {
  kp: {
    short: "КП",
    label: "компьютерная помощь",
    visual: "ноутбук, монитор, мастер за компьютером, синие и оранжевые акценты",
    postAngles: [
      "мастер диагностирует ноутбук на дому у клиента",
      "чистый рабочий стол с ноутбуком и инструментами для ремонта ПК",
      "довольный клиент и работающий компьютер, акцент на надёжность сервиса",
    ],
  },
  mnch: {
    short: "МнЧ",
    label: "мастер на час / сантехник / электрик",
    visual: "инструменты, домашний ремонт, мастер на выезде, тёплые цвета",
    postAngles: [
      "мастер выполняет мелкий ремонт в квартире клиента",
      "набор инструментов и элементы сантехники или электрики",
      "аккуратно выполненная работа, доверие и пунктуальность мастера",
    ],
  },
  bt: {
    short: "БТ",
    label: "ремонт бытовой техники",
    visual: "холодильник, стиральная машина, мастер с инструментом",
    postAngles: [
      "мастер ремонтирует бытовую технику на дому",
      "крупный план неисправной техники и диагностики",
      "отремонтированная техника и довольный клиент, гарантия качества",
    ],
  },
};

type TaskPromptInput = Pick<
  VkTask,
  "accountGroup" | "city" | "service" | "phone" | "siteUrl" | "vkName" | "vkDescription"
>;

function themeForTask(task: TaskPromptInput): GroupImageTheme {
  return GROUP_IMAGE_THEMES[task.accountGroup] ?? GROUP_IMAGE_THEMES.mnch;
}

function baseContext(task: TaskPromptInput): string {
  const theme = themeForTask(task);
  return `«${task.vkName}», ${task.service}, ${task.city}. Тематика: ${theme.short} — ${theme.label}.`;
}

export function buildAvatarPrompt(task: TaskPromptInput): string {
  const theme = themeForTask(task);
  return [
    `Квадратный аватар VK 1:1 для сообщества ${baseContext(task)}`,
    `Визуал: ${theme.visual}.`,
    "Минимализм, без мелкого текста, читаемо на мобильном, без водяных знаков.",
    "Стиль: современная плоская иллюстрация или чистая 3D-иконка, высокий контраст.",
  ].join(" ");
}

export function buildCoverPrompt(task: TaskPromptInput): string {
  const theme = themeForTask(task);
  return [
    `Обложка VK 1590×400 для ${baseContext(task)}`,
    `Визуал: ${theme.visual}.`,
    `Крупный заголовок услуги, город ${task.city}. Контакты: ${task.phone}, ${task.siteUrl}.`,
    "Широкий горизонтальный баннер, без перегруза деталями, без водяных знаков.",
  ].join(" ");
}

export function buildPostImagePrompts(task: TaskPromptInput): string[] {
  const theme = themeForTask(task);
  const snippet = task.vkDescription.trim().slice(0, 120);

  return theme.postAngles.map((angle, index) =>
    [
      `Иллюстрация для поста VK #${index + 1} (${theme.short}): ${baseContext(task)}`,
      `Сцена: ${angle}.`,
      snippet ? `Контекст: ${snippet}.` : "",
      "Формат 4:5 или 1:1, яркий, понятный без текста на изображении, без водяных знаков.",
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function buildImageAssetsPrompts(task: TaskPromptInput) {
  return {
    avatarPrompt: buildAvatarPrompt(task),
    coverPrompt: buildCoverPrompt(task),
    postImagePrompts: buildPostImagePrompts(task),
  };
}
