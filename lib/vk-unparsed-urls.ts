import fs from "fs";
import path from "path";
import { parseVkGroupUrl } from "./vk-url";

const UNPARSED_PATH = path.join(process.cwd(), "data", "vk-unparsed-urls.json");

export interface VkUnparsedUrl {
  id: string;
  vkUrl: string;
  addedAt: string;
  source: "bulk_import" | "manual";
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return `unparsed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readVkUnparsedUrlsFile(): VkUnparsedUrl[] {
  if (!fs.existsSync(UNPARSED_PATH)) {
    return [];
  }

  const content = fs.readFileSync(UNPARSED_PATH, "utf-8");
  const parsed = JSON.parse(content) as Partial<VkUnparsedUrl>[];

  if (!Array.isArray(parsed)) {
    throw new Error("data/vk-unparsed-urls.json должен содержать массив");
  }

  return parsed
    .map((item) => ({
      id: item.id ?? createId(),
      vkUrl: item.vkUrl?.trim() ?? "",
      addedAt: item.addedAt ?? nowIso(),
      source: (item.source === "manual" ? "manual" : "bulk_import") as VkUnparsedUrl["source"],
    }))
    .filter((item) => item.vkUrl.length > 0);
}

export function writeVkUnparsedUrlsFile(items: VkUnparsedUrl[]): void {
  fs.mkdirSync(path.dirname(UNPARSED_PATH), { recursive: true });
  fs.writeFileSync(UNPARSED_PATH, JSON.stringify(items, null, 2) + "\n", "utf-8");
}

export function addVkUnparsedUrls(
  urls: string[],
  source: VkUnparsedUrl["source"] = "bulk_import"
): VkUnparsedUrl[] {
  const existing = readVkUnparsedUrlsFile();
  const existingUrls = new Set(existing.map((item) => item.vkUrl.toLowerCase()));
  const added: VkUnparsedUrl[] = [];
  const timestamp = nowIso();

  for (const raw of urls) {
    const parsed = parseVkGroupUrl(raw);
    const vkUrl = parsed.vkUrl || raw.trim();
    if (!vkUrl) continue;
    if (existingUrls.has(vkUrl.toLowerCase())) continue;

    const item: VkUnparsedUrl = {
      id: createId(),
      vkUrl,
      addedAt: timestamp,
      source,
    };
    existing.push(item);
    added.push(item);
    existingUrls.add(vkUrl.toLowerCase());
  }

  writeVkUnparsedUrlsFile(existing);
  return added;
}

export function removeVkUnparsedUrlsByIds(ids: string[]): VkUnparsedUrl[] {
  const idSet = new Set(ids);
  const existing = readVkUnparsedUrlsFile();
  const remaining = existing.filter((item) => !idSet.has(item.id));
  writeVkUnparsedUrlsFile(remaining);
  return remaining;
}

export function clearVkUnparsedUrls(): void {
  writeVkUnparsedUrlsFile([]);
}
