/**
 * Пересобрать data/vk-tasks.json из обновлённого data/vk-plan.csv (4185),
 * СОХРАНИВ операционное состояние уже заведённых сообществ (по slug):
 * vkUrl, vkGroupId, assignedAccount, manualCreated, status и пр.
 *
 * Новые slug'и (появившиеся после расширения на все города) добавляются как new.
 * Запуск: npx tsx scripts/vk-rebuild-tasks.ts
 */
import fs from "fs";
import path from "path";
import { createVkTasksFromPlan, readVkTasksFile, writeVkTasksFile } from "../lib/vk-tasks";
import type { VkTask } from "../lib/vk-task-types";

// Поля, которые несут операторский прогресс — их переносим со старой задачи.
const PRESERVE: (keyof VkTask)[] = [
  "vkUrl",
  "vkGroupId",
  "assignedAccount",
  "assignedAt",
  "manualCreated",
  "lastBindBatchId",
  "qualityCheck",
  "manualSetup",
  "status",
  "createdAt",
];

function main() {
  const tasksPath = path.join(process.cwd(), "data", "vk-tasks.json");
  const hadFile = fs.existsSync(tasksPath);
  const oldById = new Map<string, VkTask>();
  if (hadFile) {
    for (const t of readVkTasksFile()) oldById.set(t.slug, t);
  }

  const fresh = createVkTasksFromPlan();
  let preserved = 0;
  const merged = fresh.map((task) => {
    const old = oldById.get(task.slug);
    if (!old) return task;
    // Переносим прогресс, только если он реально есть (не пустой/не new).
    const carried: Partial<VkTask> = {};
    for (const k of PRESERVE) {
      const v = old[k];
      if (v !== undefined && v !== null && v !== "" && !(k === "status" && v === "new")) {
        (carried as Record<string, unknown>)[k] = v;
      }
    }
    if (Object.keys(carried).length > 0) preserved++;
    return { ...task, ...carried };
  });

  writeVkTasksFile(merged);
  console.log(
    `vk-tasks.json пересобран: ${merged.length} задач (было ${oldById.size}), ` +
      `перенесён прогресс по ${preserved} сообществам.`
  );
}

main();
