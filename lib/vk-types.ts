export type VkAccountGroup = "kp" | "bt" | "mnch";

export interface VkPlanRow {
  city: string;
  service: string;
  slug: string;
  phone: string;
  siteUrl: string;
  vkName: string;
  vkDescription: string;
  vkStatus: string;
  vkFirstPost: string;
  vkKeywords: string;
  accountGroup: VkAccountGroup;
  status: string;
}

export function formatVkPlanRowForCopy(row: VkPlanRow): string {
  return [
    `Название: ${row.vkName}`,
    "",
    "Описание:",
    row.vkDescription,
    "",
    "Статус:",
    row.vkStatus,
    "",
    "Первый пост:",
    row.vkFirstPost,
    "",
    "Ключевые слова:",
    row.vkKeywords,
    "",
    `Группа аккаунта: ${row.accountGroup}`,
    `Статус создания: ${row.status}`,
  ].join("\n");
}
