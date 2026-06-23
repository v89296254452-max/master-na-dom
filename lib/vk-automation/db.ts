import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  ensureVkAutomationDirs,
  getAccountProfilePath,
  getAccountSessionPath,
  VK_AUTOMATION_CONFIG,
} from "./config";
import type {
  VkBrowserAccount,
  VkBrowserAuthStatus,
  VkBrowserCity,
  VkBrowserGroup,
  VkBrowserJob,
  VkBrowserJobAction,
  VkBrowserJobStatus,
  VkBrowserLogEntry,
  VkBrowserQueueStats,
  VkBrowserTask,
  VkBrowserTaskStatus,
} from "./types";
import {
  VK_BROWSER_AUTH_STATUSES,
  VK_BROWSER_JOB_ACTIONS,
  VK_BROWSER_JOB_STATUSES,
  VK_BROWSER_TASK_STATUSES,
} from "./types";

let dbInstance: Database.Database | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return {};
}

function toAccount(row: Record<string, unknown>): VkBrowserAccount {
  return {
    id: String(row.id),
    login: String(row.login ?? ""),
    password: String(row.password ?? ""),
    proxy: String(row.proxy ?? ""),
    status: (row.status as VkBrowserAccount["status"]) ?? "active",
    authStatus: mapAuthStatus(row.auth_status),
    sessionPath: String(row.session_path ?? ""),
    profilePath: String(row.profile_path ?? ""),
    lastUse: String(row.last_use ?? ""),
    errorMessage: String(row.error_message ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapAuthStatus(value: unknown): VkBrowserAuthStatus {
  if (typeof value === "string" && VK_BROWSER_AUTH_STATUSES.includes(value as VkBrowserAuthStatus)) {
    return value as VkBrowserAuthStatus;
  }
  return "not_connected";
}

function mapJobAction(value: unknown): VkBrowserJobAction {
  if (typeof value === "string" && VK_BROWSER_JOB_ACTIONS.includes(value as VkBrowserJobAction)) {
    return value as VkBrowserJobAction;
  }
  return "auth_check";
}

function mapJobStatus(value: unknown): VkBrowserJobStatus {
  if (typeof value === "string" && VK_BROWSER_JOB_STATUSES.includes(value as VkBrowserJobStatus)) {
    return value as VkBrowserJobStatus;
  }
  return "pending";
}

function mapTaskStatus(value: unknown): VkBrowserTaskStatus {
  if (typeof value === "string" && VK_BROWSER_TASK_STATUSES.includes(value as VkBrowserTaskStatus)) {
    return value as VkBrowserTaskStatus;
  }
  return "pending";
}

function toJob(row: Record<string, unknown>): VkBrowserJob {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    taskId: row.task_id === null || row.task_id === undefined ? null : Number(row.task_id),
    action: mapJobAction(row.action),
    status: mapJobStatus(row.status),
    payload: parseJsonObject(row.payload),
    result: parseJsonObject(row.result),
    error: String(row.error ?? ""),
    attempts: Number(row.attempts ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    startedAt: String(row.started_at ?? ""),
    completedAt: String(row.completed_at ?? ""),
  };
}

function toTask(row: Record<string, unknown>): VkBrowserTask {
  return {
    id: Number(row.id),
    accountId: String(row.account_id ?? ""),
    cityId: row.city_id === null || row.city_id === undefined ? null : Number(row.city_id),
    phone: String(row.phone ?? ""),
    groupName: String(row.group_name ?? ""),
    status: mapTaskStatus(row.status),
    payload: parseJsonObject(row.payload),
    errorMessage: String(row.error_message ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function toCity(row: Record<string, unknown>): VkBrowserCity {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    region: String(row.region ?? ""),
    used: Number(row.used ?? 0),
  };
}

function toGroup(row: Record<string, unknown>): VkBrowserGroup {
  return {
    id: Number(row.id),
    accountId: String(row.account_id ?? ""),
    taskId: row.task_id === null || row.task_id === undefined ? null : Number(row.task_id),
    name: String(row.name ?? ""),
    vkUrl: String(row.vk_url ?? ""),
    vkGroupId: String(row.vk_group_id ?? ""),
    description: String(row.description ?? ""),
    city: String(row.city ?? ""),
    phone: String(row.phone ?? ""),
    status: String(row.status ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function toLog(row: Record<string, unknown>): VkBrowserLogEntry {
  return {
    id: Number(row.id),
    jobId: String(row.job_id ?? ""),
    accountId: String(row.account_id ?? ""),
    level: (row.level as VkBrowserLogEntry["level"]) ?? "info",
    message: String(row.message ?? ""),
    screenshotPath: String(row.screenshot_path ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      login TEXT NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      proxy TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      auth_status TEXT NOT NULL DEFAULT 'not_connected',
      session_path TEXT NOT NULL DEFAULT '',
      profile_path TEXT NOT NULL DEFAULT '',
      last_use TEXT NOT NULL DEFAULT '',
      error_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT '',
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL DEFAULT '',
      task_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      vk_url TEXT NOT NULL DEFAULT '',
      vk_group_id TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL DEFAULT '',
      city_id INTEGER,
      phone TEXT NOT NULL DEFAULT '',
      group_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      payload TEXT NOT NULL DEFAULT '{}',
      error_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS keys (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      task_id INTEGER,
      action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload TEXT NOT NULL DEFAULT '{}',
      result TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT '',
      completed_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL DEFAULT '',
      account_id TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      screenshot_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_account ON jobs(account_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    CREATE TABLE IF NOT EXISTS proxies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      host TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS phones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      normalized TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      login TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'post',
      source TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      file_path TEXT NOT NULL DEFAULT '',
      source_path TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      copied_path TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      dedupe_key TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      dry_run INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dedupe_registry (
      dedupe_key TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      ref_id TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_login ON accounts(login);
    CREATE INDEX IF NOT EXISTS idx_groups_vk_url ON groups(vk_url);
    CREATE INDEX IF NOT EXISTS idx_import_logs_run ON import_logs(run_id);
  `);
}

export function getVkAutomationDb(): Database.Database {
  if (dbInstance) return dbInstance;

  ensureVkAutomationDirs();
  const dbDir = path.dirname(VK_AUTOMATION_CONFIG.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(VK_AUTOMATION_CONFIG.dbPath);
  dbInstance.pragma("journal_mode = WAL");
  initSchema(dbInstance);
  return dbInstance;
}

export function closeVkAutomationDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function listAccounts(): VkBrowserAccount[] {
  const db = getVkAutomationDb();
  const rows = db.prepare("SELECT * FROM accounts ORDER BY login").all() as Record<string, unknown>[];
  return rows.map(toAccount);
}

export function getAccountById(accountId: string): VkBrowserAccount | null {
  const db = getVkAutomationDb();
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as Record<string, unknown> | undefined;
  return row ? toAccount(row) : null;
}

export function upsertAccount(input: Partial<VkBrowserAccount> & { id: string; login: string }): VkBrowserAccount {
  const db = getVkAutomationDb();
  const existing = getAccountById(input.id);
  const now = nowIso();
  const sessionPath = input.sessionPath ?? existing?.sessionPath ?? getAccountSessionPath(input.id);
  const profilePath = input.profilePath ?? existing?.profilePath ?? getAccountProfilePath(input.id);

  const account: VkBrowserAccount = {
    id: input.id,
    login: input.login,
    password: input.password ?? existing?.password ?? "",
    proxy: input.proxy ?? existing?.proxy ?? "",
    status: input.status ?? existing?.status ?? "active",
    authStatus: input.authStatus ?? existing?.authStatus ?? "not_connected",
    sessionPath,
    profilePath,
    lastUse: input.lastUse ?? existing?.lastUse ?? "",
    errorMessage: input.errorMessage ?? existing?.errorMessage ?? "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO accounts (
      id, login, password, proxy, status, auth_status, session_path, profile_path,
      last_use, error_message, created_at, updated_at
    ) VALUES (
      @id, @login, @password, @proxy, @status, @authStatus, @sessionPath, @profilePath,
      @lastUse, @errorMessage, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      login = excluded.login,
      password = excluded.password,
      proxy = excluded.proxy,
      status = excluded.status,
      auth_status = excluded.auth_status,
      session_path = excluded.session_path,
      profile_path = excluded.profile_path,
      last_use = excluded.last_use,
      error_message = excluded.error_message,
      updated_at = excluded.updated_at
  `).run({
    id: account.id,
    login: account.login,
    password: account.password,
    proxy: account.proxy,
    status: account.status,
    authStatus: account.authStatus,
    sessionPath: account.sessionPath,
    profilePath: account.profilePath,
    lastUse: account.lastUse,
    errorMessage: account.errorMessage,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  });

  return account;
}

export function updateAccountAuth(
  accountId: string,
  authStatus: VkBrowserAuthStatus,
  errorMessage = ""
): VkBrowserAccount | null {
  const account = getAccountById(accountId);
  if (!account) return null;
  return upsertAccount({
    ...account,
    authStatus,
    errorMessage,
    lastUse: nowIso(),
  });
}

export function listCities(limit = 500): VkBrowserCity[] {
  const db = getVkAutomationDb();
  const rows = db
    .prepare("SELECT * FROM cities ORDER BY name LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(toCity);
}

export function listGroups(limit = 200): VkBrowserGroup[] {
  const db = getVkAutomationDb();
  const rows = db
    .prepare("SELECT * FROM groups ORDER BY id DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(toGroup);
}

export function insertGroup(input: Omit<VkBrowserGroup, "id" | "createdAt">): VkBrowserGroup {
  const db = getVkAutomationDb();
  const createdAt = nowIso();
  const result = db.prepare(`
    INSERT INTO groups (
      account_id, task_id, name, vk_url, vk_group_id, description, city, phone, status, created_at
    ) VALUES (
      @accountId, @taskId, @name, @vkUrl, @vkGroupId, @description, @city, @phone, @status, @createdAt
    )
  `).run({
    accountId: input.accountId,
    taskId: input.taskId,
    name: input.name,
    vkUrl: input.vkUrl,
    vkGroupId: input.vkGroupId,
    description: input.description,
    city: input.city,
    phone: input.phone,
    status: input.status,
    createdAt,
  });

  return {
    id: Number(result.lastInsertRowid),
    ...input,
    createdAt,
  };
}

export function listTasks(limit = 200): VkBrowserTask[] {
  const db = getVkAutomationDb();
  const rows = db
    .prepare("SELECT * FROM tasks ORDER BY id DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(toTask);
}

export function getTaskById(taskId: number): VkBrowserTask | null {
  const db = getVkAutomationDb();
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
  return row ? toTask(row) : null;
}

export function insertTask(input: {
  accountId: string;
  cityId?: number | null;
  phone?: string;
  groupName?: string;
  payload?: Record<string, unknown>;
}): VkBrowserTask {
  const db = getVkAutomationDb();
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO tasks (account_id, city_id, phone, group_name, status, payload, error_message, created_at, updated_at)
    VALUES (@accountId, @cityId, @phone, @groupName, 'pending', @payload, '', @createdAt, @updatedAt)
  `).run({
    accountId: input.accountId,
    cityId: input.cityId ?? null,
    phone: input.phone ?? "",
    groupName: input.groupName ?? "",
    payload: JSON.stringify(input.payload ?? {}),
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: Number(result.lastInsertRowid),
    accountId: input.accountId,
    cityId: input.cityId ?? null,
    phone: input.phone ?? "",
    groupName: input.groupName ?? "",
    status: "pending",
    payload: input.payload ?? {},
    errorMessage: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTaskStatus(
  taskId: number,
  status: VkBrowserTaskStatus,
  errorMessage = ""
): void {
  const db = getVkAutomationDb();
  db.prepare(`
    UPDATE tasks SET status = @status, error_message = @errorMessage, updated_at = @updatedAt
    WHERE id = @taskId
  `).run({ taskId, status, errorMessage, updatedAt: nowIso() });
}

export function setKey(key: string, value: string): void {
  const db = getVkAutomationDb();
  db.prepare(`
    INSERT INTO keys (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run({ key, value });
}

export function getKey(key: string): string {
  const db = getVkAutomationDb();
  const row = db.prepare("SELECT value FROM keys WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function createJob(input: {
  accountId: string;
  action: VkBrowserJobAction;
  taskId?: number | null;
  payload?: Record<string, unknown>;
}): VkBrowserJob {
  const db = getVkAutomationDb();
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = nowIso();

  db.prepare(`
    INSERT INTO jobs (
      id, account_id, task_id, action, status, payload, result, error, attempts,
      created_at, updated_at, started_at, completed_at
    ) VALUES (
      @id, @accountId, @taskId, @action, 'pending', @payload, '{}', '', 0,
      @createdAt, @updatedAt, '', ''
    )
  `).run({
    id,
    accountId: input.accountId,
    taskId: input.taskId ?? null,
    action: input.action,
    payload: JSON.stringify(input.payload ?? {}),
    createdAt: now,
    updatedAt: now,
  });

  return getJobById(id)!;
}

export function getJobById(jobId: string): VkBrowserJob | null {
  const db = getVkAutomationDb();
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Record<string, unknown> | undefined;
  return row ? toJob(row) : null;
}

export function listJobs(limit = 100): VkBrowserJob[] {
  const db = getVkAutomationDb();
  const rows = db
    .prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(toJob);
}

export function claimNextJob(): VkBrowserJob | null {
  const db = getVkAutomationDb();
  const pending = db
    .prepare("SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1")
    .get() as Record<string, unknown> | undefined;

  if (!pending) return null;

  const now = nowIso();
  const attempts = Number(pending.attempts ?? 0) + 1;

  db.prepare(`
    UPDATE jobs SET status = 'running', attempts = @attempts, started_at = @startedAt, updated_at = @updatedAt
    WHERE id = @id AND status = 'pending'
  `).run({
    id: pending.id,
    attempts,
    startedAt: now,
    updatedAt: now,
  });

  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(pending.id) as Record<string, unknown>;
  if (mapJobStatus(row.status) !== "running") return null;
  return toJob(row);
}

export function completeJob(
  jobId: string,
  status: VkBrowserJobStatus,
  result: Record<string, unknown> = {},
  error = "",
  retry = false,
  maxAttempts = VK_AUTOMATION_CONFIG.workerMaxAttempts
): VkBrowserJob | null {
  const db = getVkAutomationDb();
  const job = getJobById(jobId);
  if (!job) return null;

  const now = nowIso();
  let finalStatus = status;

  if (status === "failed" && retry && job.attempts < maxAttempts) {
    finalStatus = "pending";
  }

  db.prepare(`
    UPDATE jobs SET
      status = @status,
      result = @result,
      error = @error,
      updated_at = @updatedAt,
      completed_at = @completedAt,
      started_at = CASE WHEN @status = 'pending' THEN '' ELSE started_at END
    WHERE id = @id
  `).run({
    id: jobId,
    status: finalStatus,
    result: JSON.stringify(result),
    error,
    updatedAt: now,
    completedAt: finalStatus === "pending" ? "" : now,
  });

  return getJobById(jobId);
}

export function computeQueueStats(): VkBrowserQueueStats {
  const db = getVkAutomationDb();
  const rows = db.prepare("SELECT status, COUNT(*) as cnt FROM jobs GROUP BY status").all() as {
    status: string;
    cnt: number;
  }[];

  const stats: VkBrowserQueueStats = {
    total: 0,
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const cnt = Number(row.cnt);
    stats.total += cnt;
    if (row.status === "pending") stats.pending += cnt;
    else if (row.status === "running") stats.running += cnt;
    else if (row.status === "success") stats.success += cnt;
    else if (row.status === "failed") stats.failed += cnt;
    else if (row.status === "skipped") stats.skipped += cnt;
  }

  return stats;
}

export function insertLogEntry(input: {
  jobId: string;
  accountId: string;
  level: "info" | "warn" | "error";
  message: string;
  screenshotPath?: string;
}): VkBrowserLogEntry {
  const db = getVkAutomationDb();
  const createdAt = nowIso();
  const result = db.prepare(`
    INSERT INTO logs (job_id, account_id, level, message, screenshot_path, created_at)
    VALUES (@jobId, @accountId, @level, @message, @screenshotPath, @createdAt)
  `).run({
    jobId: input.jobId,
    accountId: input.accountId,
    level: input.level,
    message: input.message,
    screenshotPath: input.screenshotPath ?? "",
    createdAt,
  });

  return {
    id: Number(result.lastInsertRowid),
    jobId: input.jobId,
    accountId: input.accountId,
    level: input.level,
    message: input.message,
    screenshotPath: input.screenshotPath ?? "",
    createdAt,
  };
}

export function listLogEntries(limit = 200): VkBrowserLogEntry[] {
  const db = getVkAutomationDb();
  const rows = db
    .prepare("SELECT * FROM logs ORDER BY id DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(toLog);
}

export function bulkInsertCities(names: string[]): number {
  const db = getVkAutomationDb();
  const insert = db.prepare("INSERT INTO cities (name, region, used) VALUES (@name, '', 0)");
  let count = 0;
  const tx = db.transaction((items: string[]) => {
    for (const name of items) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      insert.run({ name: trimmed });
      count += 1;
    }
  });
  tx(names);
  return count;
}

export function countTable(table: string): number {
  const db = getVkAutomationDb();
  const allowed = ["accounts", "cities", "groups", "tasks", "keys"];
  if (!allowed.includes(table)) return 0;
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
  return Number(row.cnt);
}
