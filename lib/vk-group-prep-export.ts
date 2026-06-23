import type { VkTask } from "./vk-task-types";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildGroupPrepCsv(tasks: VkTask[]): string {
  const header = ["taskId", "vkUrl", "vkName", "description", "siteUrl", "slug", "phone"];
  const rows = tasks.map((task) =>
    [
      task.id,
      task.vkUrl,
      task.vkName,
      task.vkDescription,
      task.siteUrl,
      task.slug,
      task.phone,
    ].map((cell) => escapeCsvCell(cell))
  );

  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
