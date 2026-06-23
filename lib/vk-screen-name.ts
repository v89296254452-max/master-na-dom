export function sanitizeVkScreenName(slug: string): string {
  let value = slug.trim().toLowerCase().replace(/-/g, "_");
  value = value.replace(/[^a-z0-9_]/g, "");
  value = value.replace(/_+/g, "_").replace(/^_|_$/g, "");

  if (!value) {
    value = "ml_group";
  }

  if (!/^[a-z]/.test(value)) {
    value = `ml_${value}`;
  }

  if (value.length > 32) {
    value = value.slice(0, 32).replace(/_+$/, "");
  }

  return value;
}

export function buildVkShortUrl(slug: string): string {
  const screenName = sanitizeVkScreenName(slug);
  return `https://vk.com/${screenName}`;
}
