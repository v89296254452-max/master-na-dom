import type { VkTask } from "./vk-task-types";
import type {
  VkDuplicateCheckResult,
  VkDuplicateField,
  VkDuplicateIssue,
  VkDuplicateKind,
} from "./vk-duplicate-check-types";
import {
  VK_DUPLICATE_FIELDS,
  VK_DUPLICATE_SIMILARITY_THRESHOLD,
} from "./vk-duplicate-check-types";

function getTaskFieldValue(task: VkTask, field: VkDuplicateField): string {
  switch (field) {
    case "vkDescription":
      return task.vkDescription;
    case "firstPost":
      return task.vkFirstPost;
    case "pinnedPost":
      return task.contentPack.pinnedPost;
    case "post2":
      return task.contentPack.post2;
    case "post3":
      return task.contentPack.post3;
    case "post4":
      return task.contentPack.post4;
    case "post5":
      return task.contentPack.post5;
    case "avatarPrompt":
      return task.contentPack.avatarPrompt;
    case "coverPrompt":
      return task.contentPack.coverPrompt;
    default:
      return "";
  }
}

export function normalizeDuplicateText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeDuplicateText(text: string): string[] {
  const normalized = normalizeDuplicateText(text);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

export function calculateWordSimilarityPercent(textA: string, textB: string): number {
  const wordsA = tokenizeDuplicateText(textA);
  const wordsB = tokenizeDuplicateText(textB);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let intersection = 0;

  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }

  return Math.round(((intersection * 2) / (setA.size + setB.size)) * 1000) / 10;
}

function classifyDuplicate(textA: string, textB: string): { kind: VkDuplicateKind | null; percent: number } {
  const normalizedA = normalizeDuplicateText(textA);
  const normalizedB = normalizeDuplicateText(textB);

  if (!normalizedA || !normalizedB) {
    return { kind: null, percent: 0 };
  }

  if (normalizedA === normalizedB) {
    return { kind: "exact", percent: 100 };
  }

  const percent = calculateWordSimilarityPercent(textA, textB);
  if (percent > VK_DUPLICATE_SIMILARITY_THRESHOLD) {
    return { kind: "similar", percent };
  }

  return { kind: null, percent };
}

function buildIssue(
  field: VkDuplicateField,
  taskA: VkTask,
  taskB: VkTask,
  kind: VkDuplicateKind,
  similarityPercent: number
): VkDuplicateIssue {
  return {
    field,
    taskId1: taskA.id,
    taskId2: taskB.id,
    group1: taskA.accountGroup,
    group2: taskB.accountGroup,
    city1: taskA.city,
    city2: taskB.city,
    service1: taskA.service,
    service2: taskB.service,
    similarityPercent,
    kind,
  };
}

export function findDuplicateIssues(tasks: VkTask[]): VkDuplicateCheckResult {
  const issues: VkDuplicateIssue[] = [];
  let exactCount = 0;
  let similarCount = 0;
  const affectedTaskIds = new Set<string>();

  for (const field of VK_DUPLICATE_FIELDS) {
    for (let i = 0; i < tasks.length; i += 1) {
      const taskA = tasks[i];
      const valueA = getTaskFieldValue(taskA, field).trim();
      if (!valueA) continue;

      for (let j = i + 1; j < tasks.length; j += 1) {
        const taskB = tasks[j];
        const valueB = getTaskFieldValue(taskB, field).trim();
        if (!valueB) continue;

        const result = classifyDuplicate(valueA, valueB);
        if (!result.kind) continue;

        issues.push(buildIssue(field, taskA, taskB, result.kind, result.percent));

        if (result.kind === "exact") {
          exactCount += 1;
        } else {
          similarCount += 1;
        }

        affectedTaskIds.add(taskA.id);
        affectedTaskIds.add(taskB.id);
      }
    }
  }

  issues.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "exact" ? -1 : 1;
    return b.similarityPercent - a.similarityPercent;
  });

  return {
    totalChecked: tasks.length,
    exactCount,
    similarCount,
    issues,
    affectedTaskIds: Array.from(affectedTaskIds).sort(),
    cleanTaskCount: tasks.length - affectedTaskIds.size,
  };
}

export function getProblematicTaskIds(result: VkDuplicateCheckResult): string[] {
  return result.affectedTaskIds;
}
