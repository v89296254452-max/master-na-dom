import fs from "fs";
import path from "path";
import type { VkAccountMergeEntry } from "./types";

const MERGE_PATH = path.join(process.cwd(), "data", "vk-account-merge.json");

function normalizeBrowserAccountId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).trim();
  if (!str || str === "0") return null;
  return str;
}

export function readAccountMergeFile(): VkAccountMergeEntry[] {
  if (!fs.existsSync(MERGE_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(MERGE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((row): row is Record<string, unknown> => row && typeof row === "object")
    .map((row) => ({
      apiAccountId: String(row.apiAccountId ?? "").trim(),
      browserAccountId: normalizeBrowserAccountId(row.browserAccountId),
      login: typeof row.login === "string" ? row.login.trim() : "",
      proxy: typeof row.proxy === "string" ? row.proxy.trim() : "",
      status: typeof row.status === "string" ? row.status.trim() : "active",
      notes: typeof row.notes === "string" ? row.notes : "",
    }))
    .filter((row) => row.apiAccountId);
}

export function writeAccountMergeFile(entries: VkAccountMergeEntry[]): void {
  const dir = path.dirname(MERGE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const serialized = entries.map((entry) => ({
    apiAccountId: entry.apiAccountId,
    browserAccountId: entry.browserAccountId ?? "",
    login: entry.login,
    proxy: entry.proxy,
    status: entry.status,
    notes: entry.notes,
  }));

  fs.writeFileSync(MERGE_PATH, `${JSON.stringify(serialized, null, 2)}\n`, "utf-8");
}

export function getAccountMergePath(): string {
  return MERGE_PATH;
}

export function isMergeEntryLinked(entry: VkAccountMergeEntry): boolean {
  return Boolean(entry.browserAccountId);
}
