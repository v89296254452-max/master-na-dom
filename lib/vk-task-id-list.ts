/** Client-safe: parse taskId lines from textarea or bulk input. */
export function parseTaskIdLines(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

export function normalizeTaskIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
    }
    return result;
  }

  if (typeof value === "string") {
    return parseTaskIdLines(value);
  }

  return [];
}
