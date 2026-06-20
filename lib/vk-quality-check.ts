export interface VkTaskQualityCheck {
  nameCopied: boolean;
  descriptionCopied: boolean;
  siteUrlAdded: boolean;
  phoneAdded: boolean;
  firstPostPublished: boolean;
  avatarAdded: boolean;
  coverAdded: boolean;
  pinnedPostPublished: boolean;
  vkUrlFilled: boolean;
}

export const VK_QUALITY_CHECK_KEYS: (keyof VkTaskQualityCheck)[] = [
  "nameCopied",
  "descriptionCopied",
  "siteUrlAdded",
  "phoneAdded",
  "firstPostPublished",
  "avatarAdded",
  "coverAdded",
  "pinnedPostPublished",
  "vkUrlFilled",
];

export const VK_QUALITY_CHECK_LABELS: Record<keyof VkTaskQualityCheck, string> = {
  nameCopied: "Название скопировано",
  descriptionCopied: "Описание скопировано",
  siteUrlAdded: "Сайт добавлен",
  phoneAdded: "Телефон добавлен",
  firstPostPublished: "Первый пост опубликован",
  avatarAdded: "Аватар добавлен",
  coverAdded: "Обложка добавлена",
  pinnedPostPublished: "Закреплённый пост опубликован",
  vkUrlFilled: "VK URL заполнен",
};

export const VK_QUALITY_REQUIRED_FOR_POSTED: (keyof VkTaskQualityCheck)[] = [
  "descriptionCopied",
  "siteUrlAdded",
  "phoneAdded",
  "firstPostPublished",
  "vkUrlFilled",
];

export const DEFAULT_QUALITY_CHECK: VkTaskQualityCheck = {
  nameCopied: false,
  descriptionCopied: false,
  siteUrlAdded: false,
  phoneAdded: false,
  firstPostPublished: false,
  avatarAdded: false,
  coverAdded: false,
  pinnedPostPublished: false,
  vkUrlFilled: false,
};

export const VK_QUALITY_CHECK_TOTAL = VK_QUALITY_CHECK_KEYS.length;

export function normalizeQualityCheck(raw: unknown): VkTaskQualityCheck {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_QUALITY_CHECK };
  }

  const source = raw as Partial<VkTaskQualityCheck>;
  const result = { ...DEFAULT_QUALITY_CHECK };

  for (const key of VK_QUALITY_CHECK_KEYS) {
    if (typeof source[key] === "boolean") {
      result[key] = source[key];
    }
  }

  return result;
}

export function mergeQualityCheck(
  current: VkTaskQualityCheck,
  patch: Partial<VkTaskQualityCheck>
): VkTaskQualityCheck {
  const base = normalizeQualityCheck(current);
  const result = { ...base };

  for (const key of VK_QUALITY_CHECK_KEYS) {
    if (typeof patch[key] === "boolean") {
      result[key] = patch[key];
    }
  }

  return result;
}

export function countQualityCheckCompleted(qualityCheck: VkTaskQualityCheck): number {
  return VK_QUALITY_CHECK_KEYS.filter((key) => qualityCheck[key]).length;
}

export function getQualityCheckPercent(qualityCheck: VkTaskQualityCheck): number {
  return Math.round((countQualityCheckCompleted(qualityCheck) / VK_QUALITY_CHECK_TOTAL) * 1000) / 10;
}

export function isQualityCheckComplete(qualityCheck: VkTaskQualityCheck): boolean {
  return countQualityCheckCompleted(qualityCheck) === VK_QUALITY_CHECK_TOTAL;
}

export function canSetPostedStatus(qualityCheck: VkTaskQualityCheck): boolean {
  return VK_QUALITY_REQUIRED_FOR_POSTED.every((key) => qualityCheck[key]);
}

export function getMissingRequiredForPosted(
  qualityCheck: VkTaskQualityCheck
): (keyof VkTaskQualityCheck)[] {
  return VK_QUALITY_REQUIRED_FOR_POSTED.filter((key) => !qualityCheck[key]);
}

export function getPostedBlockedMessage(qualityCheck: VkTaskQualityCheck): string {
  const missing = getMissingRequiredForPosted(qualityCheck);
  if (missing.length === 0) {
    return "Нельзя поставить статус «Опубликовано» без заполненного чеклиста";
  }

  const labels = missing.map((key) => VK_QUALITY_CHECK_LABELS[key]).join(", ");
  return `Нельзя поставить «Опубликовано»: не отмечены обязательные пункты — ${labels}`;
}

export function formatQualityCheckScore(qualityCheck: VkTaskQualityCheck): string {
  return `${countQualityCheckCompleted(qualityCheck)}/${VK_QUALITY_CHECK_TOTAL}`;
}
