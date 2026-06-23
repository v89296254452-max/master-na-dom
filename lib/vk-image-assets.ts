import fs from "fs";
import path from "path";
import { normalizeImageAssets, type VkTaskImageAssets } from "./vk-image-assets-types";
import type { VkTask } from "./vk-task-types";

export type VkAssetFolder = "avatars" | "covers" | "posts";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const VK_ASSETS_ROOT = "vk-assets";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const FOLDER_WARNINGS: Record<VkAssetFolder, string> = {
  avatars: "Папка avatars пуста — avatarPath не назначен",
  covers: "Папка covers пуста — coverPath не назначен",
  posts: "Папка posts пуста — postImagePaths не назначены",
};

function folderRelativePath(folder: VkAssetFolder): string {
  return `${VK_ASSETS_ROOT}/${folder}`;
}

function toPublicPath(folder: VkAssetFolder, filename: string): string {
  return `/${folderRelativePath(folder)}/${filename}`.replace(/\\/g, "/");
}

export function listImageFiles(folder: VkAssetFolder): string[] {
  const relativeDir = folderRelativePath(folder);
  const absoluteDir = path.join(PUBLIC_ROOT, relativeDir);

  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  return fs
    .readdirSync(absoluteDir)
    .filter((name) => {
      const absolutePath = path.join(absoluteDir, name);
      if (!fs.statSync(absolutePath).isFile()) return false;
      return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
    })
    .map((name) => toPublicPath(folder, name))
    .sort((a, b) => a.localeCompare(b));
}

export function pickRandomImage(folder: VkAssetFolder): string | null {
  const files = listImageFiles(folder);
  if (files.length === 0) return null;
  const index = Math.floor(Math.random() * files.length);
  return files[index] ?? null;
}

export function pickRandomImages(folder: VkAssetFolder, count: number): string[] {
  if (count <= 0) return [];

  const files = listImageFiles(folder);
  if (files.length === 0) return [];

  const shuffled = [...files].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export interface AssignRandomImagesResult {
  imageAssets: VkTaskImageAssets;
  warnings: string[];
}

export function assignRandomImagesToTask(task: VkTask): AssignRandomImagesResult {
  const existing = normalizeImageAssets(task.imageAssets);
  const warnings: string[] = [];

  const avatarPath = pickRandomImage("avatars");
  if (!avatarPath) {
    warnings.push(FOLDER_WARNINGS.avatars);
  }

  const coverPath = pickRandomImage("covers");
  if (!coverPath) {
    warnings.push(FOLDER_WARNINGS.covers);
  }

  const postImagePaths = pickRandomImages("posts", 2);
  if (postImagePaths.length === 0) {
    warnings.push(FOLDER_WARNINGS.posts);
  } else if (postImagePaths.length < 2) {
    warnings.push(`В папке posts только ${postImagePaths.length} картинка — назначена частично`);
  }

  return {
    imageAssets: {
      ...existing,
      avatarPath: avatarPath ?? "",
      coverPath: coverPath ?? "",
      postImagePaths,
    },
    warnings,
  };
}
