import fs from "fs";
import path from "path";

function envString(key: string, fallback: string): string {
  const value = process.env[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

const DATA_ROOT = path.join(process.cwd(), "data", "vk-automation");

export const VK_AUTOMATION_CONFIG = {
  dbPath: envString("VK_AUTOMATION_DB_PATH", path.join(DATA_ROOT, "vk-automation.db")),
  oldDbPath: envString("VK_OLD_DB_PATH", ""),
  oldDataDir: envString("VK_OLD_DATA_DIR", path.join(process.cwd(), "ДМ1")),
  presetDir: envString("VK_PRESET_DIR", path.join(process.cwd(), "ДМ1", "Preset")),
  profilesDir: envString("VK_PROFILES_DIR", path.join(DATA_ROOT, "profiles")),
  sessionsDir: envString("VK_SESSIONS_DIR", path.join(DATA_ROOT, "sessions")),
  screenshotsDir: envString("VK_SCREENSHOTS_DIR", path.join(DATA_ROOT, "screenshots")),
  workerIntervalMs: Math.max(500, envNumber("VK_WORKER_INTERVAL_MS", 5000)),
  workerMaxAttempts: Math.max(1, envNumber("VK_WORKER_MAX_ATTEMPTS", 3)),
  browserHeadless: envBool("VK_BROWSER_HEADLESS", false),
  actionDelayMs: Math.max(100, envNumber("VK_ACTION_DELAY_MS", 800)),
  authManualTimeoutMs: Math.max(60000, envNumber("VK_AUTH_MANUAL_TIMEOUT_MS", 600000)),
  appUrl: envString("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/+$/, ""),
  vkLoginUrl: envString("VK_LOGIN_URL", "https://vk.com"),
  vkGroupsUrl: envString("VK_GROUPS_URL", "https://vk.com/groups?act=create"),
};

export function ensureVkAutomationDirs(): void {
  const dirs = [
    path.dirname(VK_AUTOMATION_CONFIG.dbPath),
    VK_AUTOMATION_CONFIG.profilesDir,
    VK_AUTOMATION_CONFIG.sessionsDir,
    VK_AUTOMATION_CONFIG.screenshotsDir,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function getAccountProfilePath(accountId: string): string {
  return path.join(VK_AUTOMATION_CONFIG.profilesDir, accountId);
}

export function getAccountSessionPath(accountId: string): string {
  return path.join(VK_AUTOMATION_CONFIG.sessionsDir, `${accountId}.json`);
}

export function resolvePresetPath(...segments: string[]): string {
  const base = VK_AUTOMATION_CONFIG.presetDir;
  if (!base) return "";
  return path.join(base, ...segments);
}

export function readPresetText(filename: string): string {
  const filePath = resolvePresetPath(filename);
  if (!filePath || !fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8").trim();
}
