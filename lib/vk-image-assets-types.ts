/** Client-safe image asset fields on VkTask */
export interface VkTaskImageAssets {
  avatarPath: string;
  coverPath: string;
  postImagePaths: string[];
  avatarPrompt: string;
  coverPrompt: string;
  postImagePrompts: string[];
}

export const DEFAULT_VK_TASK_IMAGE_ASSETS: VkTaskImageAssets = {
  avatarPath: "",
  coverPath: "",
  postImagePaths: [],
  avatarPrompt: "",
  coverPrompt: "",
  postImagePrompts: [],
};

export type VkImageAssetType = "avatar" | "cover" | "post";

export const VK_IMAGE_ASSET_TYPE_LABELS: Record<VkImageAssetType, string> = {
  avatar: "Аватар",
  cover: "Обложка",
  post: "Пост",
};

export function normalizeImageAssets(raw: unknown): VkTaskImageAssets {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_VK_TASK_IMAGE_ASSETS };
  }

  const source = raw as Partial<VkTaskImageAssets>;
  return {
    avatarPath: typeof source.avatarPath === "string" ? source.avatarPath : "",
    coverPath: typeof source.coverPath === "string" ? source.coverPath : "",
    postImagePaths: Array.isArray(source.postImagePaths)
      ? source.postImagePaths.filter((item): item is string => typeof item === "string")
      : [],
    avatarPrompt: typeof source.avatarPrompt === "string" ? source.avatarPrompt : "",
    coverPrompt: typeof source.coverPrompt === "string" ? source.coverPrompt : "",
    postImagePrompts: Array.isArray(source.postImagePrompts)
      ? source.postImagePrompts.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function getImageAssetsIndicators(imageAssets: VkTaskImageAssets | unknown): {
  avatar: string;
  cover: string;
  posts: string;
} {
  const assets = normalizeImageAssets(imageAssets);
  const postCount = assets.postImagePaths.filter((item) => item.trim()).length;

  return {
    avatar: assets.avatarPath.trim() ? "✅" : "—",
    cover: assets.coverPath.trim() ? "✅" : "—",
    posts: `${postCount}/2`,
  };
}
