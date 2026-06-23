export type VkImportEntity =
  | "vk_accounts"
  | "vk_proxies"
  | "vk_cities"
  | "vk_services"
  | "vk_tasks"
  | "vk_keywords"
  | "vk_group_templates"
  | "vk_post_templates"
  | "vk_media_assets"
  | "vk_groups"
  | "vk_phones";

export type VkImportSourceKind = "sqlite" | "txt" | "csv" | "json" | "directory" | "xlsx";

export type VkImportAction = "insert" | "skip" | "update" | "error";

export interface VkImportSource {
  id: string;
  label: string;
  path: string;
  kind: VkImportSourceKind;
  entities: VkImportEntity[];
  exists: boolean;
  sizeBytes?: number;
  lineCount?: number;
  note?: string;
}

export interface VkImportRecord {
  entity: VkImportEntity;
  dedupeKey: string;
  sourceId: string;
  data: Record<string, unknown>;
}

export interface VkImportEntityPreview {
  entity: VkImportEntity;
  total: number;
  new: number;
  duplicate: number;
  updated: number;
  errors: number;
  samples: Record<string, unknown>[];
}

export interface VkImportPreviewResult {
  runId: string;
  dryRun: boolean;
  sources: VkImportSource[];
  entities: VkImportEntityPreview[];
  warnings: string[];
  logs: VkImportLogEntry[];
}

export interface VkImportRunResult extends VkImportPreviewResult {
  applied: boolean;
  durationMs: number;
}

export interface VkImportLogEntry {
  sourceId: string;
  entity: VkImportEntity;
  action: VkImportAction;
  dedupeKey: string;
  message: string;
}

export const VK_IMPORT_ENTITY_LABELS: Record<VkImportEntity, string> = {
  vk_accounts: "Аккаунты VK",
  vk_proxies: "Прокси",
  vk_cities: "Города",
  vk_services: "Услуги / работы",
  vk_tasks: "Задания (город+услуга)",
  vk_keywords: "Ключевые слова",
  vk_group_templates: "Шаблоны описаний групп",
  vk_post_templates: "Шаблоны постов",
  vk_media_assets: "Медиа (аватар/обложка/фото)",
  vk_groups: "Группы VK",
  vk_phones: "Телефоны",
};
