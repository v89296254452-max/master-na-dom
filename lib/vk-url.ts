export type VkGroupUrlType = "club" | "public" | "event" | "screen_name" | "unknown";

export interface ParsedVkGroupUrl {
  vkUrl: string;
  vkGroupId: string;
  screenName: string;
  type: VkGroupUrlType;
}

const NUMERIC_PREFIXES = ["club", "public", "event"] as const;

type NumericPrefix = (typeof NUMERIC_PREFIXES)[number];

function buildNumericResult(prefix: NumericPrefix, id: string): ParsedVkGroupUrl {
  return {
    vkUrl: `https://vk.com/${prefix}${id}`,
    vkGroupId: id,
    screenName: "",
    type: prefix,
  };
}

function tryParseNumericPath(pathPart: string): ParsedVkGroupUrl | null {
  for (const prefix of NUMERIC_PREFIXES) {
    const match = pathPart.match(new RegExp(`^${prefix}(\\d+)$`, "i"));
    if (match?.[1]) {
      return buildNumericResult(prefix, match[1]);
    }
  }
  return null;
}

export function parseVkGroupUrl(vkUrl: string): ParsedVkGroupUrl {
  let raw = vkUrl.trim();

  if (!raw) {
    return { vkUrl: "", vkGroupId: "", screenName: "", type: "unknown" };
  }

  raw = raw.replace(/^@+/, "");

  const bareNumeric = tryParseNumericPath(raw);
  if (bareNumeric) {
    return bareNumeric;
  }

  let normalized = raw;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^vk\.com\//i, "");
    normalized = `https://vk.com/${normalized.replace(/^\/+/, "")}`;
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return { vkUrl: raw, vkGroupId: "", screenName: "", type: "unknown" };
  }

  if (!url.hostname.toLowerCase().includes("vk.com")) {
    return { vkUrl: url.toString(), vkGroupId: "", screenName: "", type: "unknown" };
  }

  const pathPart = url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  if (!pathPart) {
    return { vkUrl: "https://vk.com/", vkGroupId: "", screenName: "", type: "unknown" };
  }

  const numeric = tryParseNumericPath(pathPart);
  if (numeric) {
    return numeric;
  }

  const reserved = new Set([
    "id",
    "feed",
    "im",
    "mail",
    "settings",
    "video",
    "audio",
    "market",
    "apps",
    "login",
    "join",
  ]);

  if (!reserved.has(pathPart.toLowerCase())) {
    return {
      vkUrl: `https://vk.com/${pathPart}`,
      vkGroupId: "",
      screenName: pathPart,
      type: "screen_name",
    };
  }

  return {
    vkUrl: `https://vk.com/${pathPart}`,
    vkGroupId: "",
    screenName: "",
    type: "unknown",
  };
}

export function taskNeedsVkUrlResolve(task: { vkUrl: string; vkGroupId: string }): boolean {
  return !task.vkGroupId.trim() && task.vkUrl.trim().length > 0;
}

export function taskNeedsVkGroupId(task: { vkGroupId: string }): boolean {
  return !task.vkGroupId.trim();
}
