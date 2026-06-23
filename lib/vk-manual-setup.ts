export interface VkTaskManualSetup {
  prepared: boolean;
  groupTitleSet: boolean;
  descriptionSet: boolean;
  websiteSet: boolean;
  screenNameSet: boolean;
  avatarUploaded: boolean;
  coverUploaded: boolean;
}

export const VK_MANUAL_SETUP_KEYS: (keyof VkTaskManualSetup)[] = [
  "groupTitleSet",
  "descriptionSet",
  "websiteSet",
  "screenNameSet",
  "avatarUploaded",
  "coverUploaded",
];

export const VK_GROUP_PREP_CHECKLIST_KEYS = VK_MANUAL_SETUP_KEYS;

export const VK_MANUAL_SETUP_LABELS: Record<keyof VkTaskManualSetup, string> = {
  prepared: "Группа подготовлена",
  groupTitleSet: "Название изменено",
  descriptionSet: "Описание заполнено",
  websiteSet: "Сайт добавлен",
  screenNameSet: "Адрес изменён",
  avatarUploaded: "Аватар загружен",
  coverUploaded: "Обложка загружена",
};

export const DEFAULT_MANUAL_SETUP: VkTaskManualSetup = {
  prepared: false,
  groupTitleSet: false,
  descriptionSet: false,
  websiteSet: false,
  screenNameSet: false,
  avatarUploaded: false,
  coverUploaded: false,
};

export const VK_MANUAL_SETUP_TOTAL = VK_MANUAL_SETUP_KEYS.length;

export type VkGroupPrepFilter = "all" | "unprepared" | "prepared" | "ready_for_publication";

export function normalizeManualSetup(raw: unknown): VkTaskManualSetup {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_MANUAL_SETUP };
  }

  const source = raw as Partial<VkTaskManualSetup>;
  const result = { ...DEFAULT_MANUAL_SETUP };

  for (const key of Object.keys(DEFAULT_MANUAL_SETUP) as (keyof VkTaskManualSetup)[]) {
    if (typeof source[key] === "boolean") {
      result[key] = source[key];
    }
  }

  return result;
}

export function mergeManualSetup(
  current: VkTaskManualSetup,
  patch: Partial<VkTaskManualSetup>
): VkTaskManualSetup {
  const base = normalizeManualSetup(current);
  const result = { ...base };

  for (const key of Object.keys(DEFAULT_MANUAL_SETUP) as (keyof VkTaskManualSetup)[]) {
    if (typeof patch[key] === "boolean") {
      result[key] = patch[key];
    }
  }

  return result;
}

export function buildPreparedManualSetup(): VkTaskManualSetup {
  return {
    prepared: true,
    groupTitleSet: true,
    descriptionSet: true,
    websiteSet: true,
    screenNameSet: true,
    avatarUploaded: true,
    coverUploaded: true,
  };
}

export function isManualSetupPrepared(manualSetup: VkTaskManualSetup | unknown): boolean {
  return normalizeManualSetup(manualSetup).prepared === true;
}

export function countManualSetupCompleted(manualSetup: VkTaskManualSetup): number {
  return VK_MANUAL_SETUP_KEYS.filter((key) => manualSetup[key]).length;
}

export function isManualSetupComplete(manualSetup: VkTaskManualSetup | unknown): boolean {
  const setup = normalizeManualSetup(manualSetup);
  return countManualSetupCompleted(setup) === VK_MANUAL_SETUP_TOTAL;
}

export function formatManualSetupScore(manualSetup: VkTaskManualSetup | unknown): string {
  const setup = normalizeManualSetup(manualSetup);
  return `${countManualSetupCompleted(setup)}/${VK_MANUAL_SETUP_TOTAL}`;
}

export function getManualSetupWarning(manualSetup: VkTaskManualSetup | unknown): string | null {
  const setup = normalizeManualSetup(manualSetup);
  if (isManualSetupPrepared(setup)) {
    return null;
  }

  const missing = VK_MANUAL_SETUP_KEYS.filter((key) => !setup[key]).map(
    (key) => VK_MANUAL_SETUP_LABELS[key]
  );

  return `Ручная подготовка группы не завершена: ${missing.join(", ")}`;
}
