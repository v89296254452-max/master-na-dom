import fs from "fs";
import path from "path";
import { appendVkTaskLogEntry } from "./vk-task-log";
import type { VkTask } from "./vk-task-types";
import {
  type VkImageAssetType,
  type VkTaskImageAssets,
  normalizeImageAssets,
} from "./vk-image-assets-types";
import { buildImageAssetsPrompts } from "./vk-image-prompts";
import {
  assignRandomImagesToTask,
  pickRandomImage,
  type AssignRandomImagesResult,
} from "./vk-image-assets";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "./vk-tasks";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const ASSET_DIRS: Record<VkImageAssetType, string> = {
  avatar: "vk-assets/avatars",
  cover: "vk-assets/covers",
  post: "vk-assets/posts",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function mergeImageAssets(
  existing: VkTaskImageAssets,
  patch: Partial<VkTaskImageAssets>
): VkTaskImageAssets {
  return {
    ...existing,
    ...patch,
    postImagePaths: patch.postImagePaths ?? existing.postImagePaths,
    postImagePrompts: patch.postImagePrompts ?? existing.postImagePrompts,
  };
}

export function generateAndSaveImagePrompts(taskId: string): VkTask {
  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === taskId);

  if (!existing) {
    throw new Error("Задача не найдена");
  }

  const prompts = buildImageAssetsPrompts(existing);
  const imageAssets = mergeImageAssets(normalizeImageAssets(existing.imageAssets), {
    ...prompts,
  });

  const updated = updateVkTask(tasks, taskId, { imageAssets });
  if (!updated) {
    throw new Error("Не удалось обновить задачу");
  }

  writeVkTasksFile(tasks);

  appendVkTaskLogEntry({
    taskId,
    action: "updated",
    oldStatus: existing.status,
    newStatus: updated.status,
    assignedAccount: updated.assignedAccount,
    vkUrl: updated.vkUrl,
    vkGroupId: updated.vkGroupId,
    message: "Сгенерированы промпты изображений VK",
  });

  return updated;
}

function extensionFromContentType(contentType: string | null): string {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  return "jpg";
}

function extensionFromUrl(imageUrl: string): string | null {
  try {
    const pathname = new URL(imageUrl).pathname.toLowerCase();
    const match = pathname.match(/\.(png|jpe?g|webp|gif)$/i);
    return match ? match[1].replace("jpeg", "jpg") : null;
  } catch {
    return null;
  }
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function downloadImage(imageUrl: string): Promise<{ buffer: Buffer; extension: string }> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error("Некорректный imageUrl");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("imageUrl должен быть http или https");
  }

  const response = await fetch(imageUrl, {
    headers: { "User-Agent": "MASTER-LEADS-VK-Image-Saver/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Не удалось скачать изображение: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`URL не является изображением: ${contentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Изображение слишком большое (макс. 10 МБ)");
  }

  const extension =
    extensionFromUrl(imageUrl) ?? extensionFromContentType(contentType);

  return {
    buffer: Buffer.from(arrayBuffer),
    extension,
  };
}

export async function saveExternalImageForTask(input: {
  taskId: string;
  type: VkImageAssetType;
  imageUrl: string;
}): Promise<VkTask> {
  const taskId = input.taskId.trim();
  const imageUrl = input.imageUrl.trim();
  const type = input.type;

  if (!taskId) throw new Error("taskId обязателен");
  if (!imageUrl) throw new Error("imageUrl обязателен");

  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === taskId);
  if (!existing) {
    throw new Error("Задача не найдена");
  }

  const { buffer, extension } = await downloadImage(imageUrl);
  const dir = ASSET_DIRS[type];
  const absDir = path.join(PUBLIC_ROOT, dir);
  fs.mkdirSync(absDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeId = sanitizeFilenamePart(taskId);
  const filename = `${safeId}-${type}-${stamp}.${extension}`;
  const absPath = path.join(absDir, filename);
  fs.writeFileSync(absPath, buffer);

  const publicPath = `/${dir}/${filename}`.replace(/\\/g, "/");
  const imageAssets = normalizeImageAssets(existing.imageAssets);

  if (type === "avatar") {
    imageAssets.avatarPath = publicPath;
  } else if (type === "cover") {
    imageAssets.coverPath = publicPath;
  } else {
    imageAssets.postImagePaths = [...imageAssets.postImagePaths, publicPath];
  }

  const updated = updateVkTask(tasks, taskId, { imageAssets });
  if (!updated) {
    throw new Error("Не удалось обновить задачу");
  }

  writeVkTasksFile(tasks);

  appendVkTaskLogEntry({
    taskId,
    action: "updated",
    oldStatus: existing.status,
    newStatus: updated.status,
    assignedAccount: updated.assignedAccount,
    vkUrl: updated.vkUrl,
    vkGroupId: updated.vkGroupId,
    message: `Сохранено изображение (${type}): ${publicPath}`,
  });

  return updated;
}

function persistTaskImageAssets(
  taskId: string,
  imageAssets: VkTaskImageAssets,
  logMessage: string
): VkTask {
  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === taskId);

  if (!existing) {
    throw new Error("Задача не найдена");
  }

  const updated = updateVkTask(tasks, taskId, { imageAssets });
  if (!updated) {
    throw new Error("Не удалось обновить задачу");
  }

  writeVkTasksFile(tasks);

  appendVkTaskLogEntry({
    taskId,
    action: "updated",
    oldStatus: existing.status,
    newStatus: updated.status,
    assignedAccount: updated.assignedAccount,
    vkUrl: updated.vkUrl,
    vkGroupId: updated.vkGroupId,
    message: logMessage,
  });

  return updated;
}

export function assignRandomImagesToTaskAndSave(taskId: string): {
  task: VkTask;
  warnings: string[];
} {
  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === taskId);

  if (!existing) {
    throw new Error("Задача не найдена");
  }

  const { imageAssets, warnings } = assignRandomImagesToTask(existing);
  const task = persistTaskImageAssets(
    taskId,
    imageAssets,
    warnings.length > 0
      ? `Назначены случайные картинки (с предупреждениями: ${warnings.length})`
      : "Назначены случайные картинки"
  );

  return { task, warnings };
}

export function assignRandomImagesBatch(taskIds?: string[]): {
  tasks: VkTask[];
  warnings: string[];
  processed: number;
} {
  const tasks = readVkTasksFile();
  const ids =
    Array.isArray(taskIds) && taskIds.length > 0
      ? taskIds.map((id) => id.trim()).filter(Boolean)
      : tasks.filter((task) => task.status === "ready_for_worker").map((task) => task.id);

  const updatedTasks: VkTask[] = [];
  const warnings: string[] = [];

  for (const taskId of ids) {
    const existing = tasks.find((task) => task.id === taskId);
    if (!existing) {
      warnings.push(`Задача не найдена: ${taskId}`);
      continue;
    }

    const assignment = assignRandomImagesToTask(existing);
    const updated = updateVkTask(tasks, taskId, { imageAssets: assignment.imageAssets });

    if (!updated) {
      warnings.push(`Не удалось обновить задачу: ${taskId}`);
      continue;
    }

    updatedTasks.push(updated);

    for (const warning of assignment.warnings) {
      warnings.push(`${taskId}: ${warning}`);
    }
  }

  if (updatedTasks.length > 0) {
    writeVkTasksFile(tasks);

    for (const task of updatedTasks) {
      appendVkTaskLogEntry({
        taskId: task.id,
        action: "updated",
        oldStatus: task.status,
        newStatus: task.status,
        assignedAccount: task.assignedAccount,
        vkUrl: task.vkUrl,
        vkGroupId: task.vkGroupId,
        message: "Назначены случайные картинки (batch)",
      });
    }
  }

  return {
    tasks: updatedTasks,
    warnings,
    processed: updatedTasks.length,
  };
}

export function autoAssignAvatarIfEmpty(taskId: string): VkTask {
  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === taskId);

  if (!existing) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const imageAssets = normalizeImageAssets(existing.imageAssets);
  if (imageAssets.avatarPath.trim()) {
    return existing;
  }

  const picked = pickRandomImage("avatars");
  if (!picked) {
    return existing;
  }

  const updated = persistTaskImageAssets(
    taskId,
    { ...imageAssets, avatarPath: picked },
    `Автоматически назначен аватар: ${picked}`
  );

  console.log(`[VK Worker] auto-picked avatar taskId=${taskId} avatarPath=${picked}`);
  return updated;
}

export function autoAssignPostImageIfEmpty(taskId: string, index: number): VkTask {
  const tasks = readVkTasksFile();
  const existing = tasks.find((task) => task.id === taskId);

  if (!existing) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const imageAssets = normalizeImageAssets(existing.imageAssets);
  if (imageAssets.postImagePaths[index]?.trim()) {
    return existing;
  }

  const picked = pickRandomImage("posts");
  if (!picked) {
    return existing;
  }

  const postImagePaths = [...imageAssets.postImagePaths];
  while (postImagePaths.length <= index) {
    postImagePaths.push("");
  }
  postImagePaths[index] = picked;

  const updated = persistTaskImageAssets(
    taskId,
    { ...imageAssets, postImagePaths },
    `Автоматически назначена картинка поста #${index + 1}: ${picked}`
  );

  console.log(
    `[VK Worker] auto-picked post image taskId=${taskId} index=${index} path=${picked}`
  );
  return updated;
}
