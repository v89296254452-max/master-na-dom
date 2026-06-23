import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { ensureVkAutomationDirs, VK_AUTOMATION_CONFIG } from "./config";
import { getVkAutomationDb } from "./db";
import type { VkImportAction, VkImportEntity, VkImportLogEntry, VkImportRecord } from "./import-types";
import {
  dedupeKeyAccount,
  normalizeCityName,
  normalizeGroupUrl,
  normalizeLogin,
  normalizePhone,
  normalizeProxyUrl,
  normalizeServiceName,
} from "./import-normalize";

function nowIso(): string {
  return new Date().toISOString();
}

function getMediaDestDir(): string {
  return path.join(path.dirname(VK_AUTOMATION_CONFIG.dbPath), "media");
}

export function hasDedupeKey(dedupeKey: string): boolean {
  const db = getVkAutomationDb();
  const row = db.prepare("SELECT dedupe_key FROM dedupe_registry WHERE dedupe_key = ?").get(dedupeKey);
  return Boolean(row);
}

export function registerDedupeKey(dedupeKey: string, entity: VkImportEntity, refId: string): void {
  const db = getVkAutomationDb();
  db.prepare(`
    INSERT INTO dedupe_registry (dedupe_key, entity, ref_id, updated_at)
    VALUES (@dedupeKey, @entity, @refId, @updatedAt)
    ON CONFLICT(dedupe_key) DO UPDATE SET ref_id = excluded.ref_id, updated_at = excluded.updated_at
  `).run({ dedupeKey, entity, refId, updatedAt: nowIso() });
}

export function writeImportLog(
  runId: string,
  entry: VkImportLogEntry,
  dryRun: boolean
): void {
  const db = getVkAutomationDb();
  db.prepare(`
    INSERT INTO import_logs (run_id, source_id, entity, action, dedupe_key, message, dry_run, created_at)
    VALUES (@runId, @sourceId, @entity, @action, @dedupeKey, @message, @dryRun, @createdAt)
  `).run({
    runId,
    sourceId: entry.sourceId,
    entity: entry.entity,
    action: entry.action,
    dedupeKey: entry.dedupeKey,
    message: entry.message,
    dryRun: dryRun ? 1 : 0,
    createdAt: nowIso(),
  });
}

export function listImportLogs(runId?: string, limit = 500): Array<{
  id: number;
  runId: string;
  sourceId: string;
  entity: string;
  action: string;
  dedupeKey: string;
  message: string;
  dryRun: boolean;
  createdAt: string;
}> {
  const db = getVkAutomationDb();
  const rows = runId
    ? db
        .prepare("SELECT * FROM import_logs WHERE run_id = ? ORDER BY id DESC LIMIT ?")
        .all(runId, limit)
    : db.prepare("SELECT * FROM import_logs ORDER BY id DESC LIMIT ?").all(limit);

  return (rows as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    runId: String(row.run_id),
    sourceId: String(row.source_id),
    entity: String(row.entity),
    action: String(row.action),
    dedupeKey: String(row.dedupe_key),
    message: String(row.message),
    dryRun: Boolean(row.dry_run),
    createdAt: String(row.created_at),
  }));
}

function upsertCity(db: Database.Database, name: string, region = "", source = ""): string | null {
  const cityName = normalizeCityName(name);
  if (!cityName) return null;
  const existing = db
    .prepare("SELECT id FROM cities WHERE lower(name) = lower(?)")
    .get(cityName) as { id: number } | undefined;
  if (existing) return String(existing.id);

  const result = db
    .prepare("INSERT INTO cities (name, region, used) VALUES (@name, @region, 0)")
    .run({ name: cityName, region });
  return String(result.lastInsertRowid);
}

export function applyImportRecord(
  runId: string,
  record: VkImportRecord,
  dryRun: boolean
): VkImportAction {
  if (hasDedupeKey(record.dedupeKey)) {
    writeImportLog(runId, {
      sourceId: record.sourceId,
      entity: record.entity,
      action: "skip",
      dedupeKey: record.dedupeKey,
      message: "Дубликат",
    }, dryRun);
    return "skip";
  }

  if (dryRun) {
    writeImportLog(runId, {
      sourceId: record.sourceId,
      entity: record.entity,
      action: "insert",
      dedupeKey: record.dedupeKey,
      message: "dry-run",
    }, dryRun);
    return "insert";
  }

  const db = getVkAutomationDb();
  const data = record.data;
  let refId = "";

  try {
    switch (record.entity) {
      case "vk_accounts": {
        const login = normalizeLogin(String(data.login ?? ""));
        const id = String(data.id ?? `acc_${login}`);
        db.prepare(`
          INSERT INTO accounts (
            id, login, password, proxy, status, auth_status, session_path, profile_path,
            last_use, error_message, created_at, updated_at
          ) VALUES (
            @id, @login, @password, @proxy, @status, 'not_connected', '', '', '', '', @createdAt, @updatedAt
          )
          ON CONFLICT(id) DO UPDATE SET
            login = excluded.login,
            password = CASE WHEN excluded.password != '' THEN excluded.password ELSE accounts.password END,
            proxy = CASE WHEN excluded.proxy != '' THEN excluded.proxy ELSE accounts.proxy END,
            status = excluded.status,
            updated_at = excluded.updated_at
        `).run({
          id,
          login,
          password: String(data.password ?? ""),
          proxy: String(data.proxy ?? ""),
          status: String(data.status ?? "active"),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        refId = id;
        break;
      }
      case "vk_proxies": {
        const url = normalizeProxyUrl(String(data.url ?? ""));
        const host = url.replace(/^[^:]+:\/\//, "").split("@").pop()?.split(":")[0] ?? "";
        const result = db.prepare(`
          INSERT INTO proxies (url, host, status, source, dedupe_key, created_at)
          VALUES (@url, @host, @status, @source, @dedupeKey, @createdAt)
        `).run({
          url,
          host,
          status: String(data.status ?? "active"),
          source: String(data.source ?? record.sourceId),
          dedupeKey: record.dedupeKey,
          createdAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      case "vk_cities": {
        const cityId = upsertCity(db, String(data.name ?? ""), String(data.region ?? ""), record.sourceId);
        refId = cityId ?? "";
        if (!cityId) throw new Error("empty city name");
        break;
      }
      case "vk_services": {
        const name = normalizeServiceName(String(data.name ?? ""));
        const result = db.prepare(`
          INSERT INTO services (name, category, slug, source, dedupe_key, created_at)
          VALUES (@name, @category, @slug, @source, @dedupeKey, @createdAt)
        `).run({
          name,
          category: String(data.category ?? ""),
          slug: String(data.slug ?? ""),
          source: String(data.source ?? record.sourceId),
          dedupeKey: record.dedupeKey,
          createdAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      case "vk_phones": {
        const phone = String(data.phone ?? "");
        const normalized = normalizePhone(phone);
        const result = db.prepare(`
          INSERT INTO phones (phone, normalized, source, created_at)
          VALUES (@phone, @normalized, @source, @createdAt)
        `).run({
          phone,
          normalized,
          source: String(data.source ?? record.sourceId),
          createdAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      case "vk_tasks": {
        const cityName = normalizeCityName(String(data.city ?? ""));
        const service = normalizeServiceName(String(data.service ?? ""));
        const phone = normalizePhone(String(data.phone ?? ""));
        const cityId = cityName ? upsertCity(db, cityName, String(data.region ?? "")) : null;
        const groupName = String(data.groupName ?? data.vkName ?? `${service} ${cityName}`).trim();
        const payload = JSON.stringify(data.payload ?? data);
        const result = db.prepare(`
          INSERT INTO tasks (account_id, city_id, phone, group_name, status, payload, error_message, created_at, updated_at)
          VALUES (@accountId, @cityId, @phone, @groupName, 'pending', @payload, '', @createdAt, @updatedAt)
        `).run({
          accountId: String(data.accountId ?? ""),
          cityId: cityId ? Number(cityId) : null,
          phone,
          groupName,
          payload,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      case "vk_keywords": {
        const result = db.prepare(`
          INSERT INTO keywords (keyword, city, service, login, source, dedupe_key, created_at)
          VALUES (@keyword, @city, @service, @login, @source, @dedupeKey, @createdAt)
        `).run({
          keyword: String(data.keyword ?? ""),
          city: normalizeCityName(String(data.city ?? "")),
          service: normalizeServiceName(String(data.service ?? "")),
          login: normalizeLogin(String(data.login ?? "")),
          source: String(data.source ?? record.sourceId),
          dedupeKey: record.dedupeKey,
          createdAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      case "vk_group_templates": {
        const result = db.prepare(`
          INSERT INTO group_templates (name, content, source, dedupe_key, created_at)
          VALUES (@name, @content, @source, @dedupeKey, @createdAt)
        `).run({
          name: String(data.name ?? ""),
          content: String(data.content ?? ""),
          source: String(data.source ?? record.sourceId),
          dedupeKey: record.dedupeKey,
          createdAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      case "vk_post_templates": {
        const result = db.prepare(`
          INSERT INTO post_templates (name, content, kind, source, dedupe_key, created_at)
          VALUES (@name, @content, @kind, @source, @dedupeKey, @createdAt)
        `).run({
          name: String(data.name ?? ""),
          content: String(data.content ?? ""),
          kind: String(data.kind ?? "post"),
          source: String(data.source ?? record.sourceId),
          dedupeKey: record.dedupeKey,
          createdAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      case "vk_media_assets": {
        const sourcePath = String(data.sourcePath ?? "");
        const kind = String(data.kind ?? "post");
        ensureVkAutomationDirs();
        const mediaRoot = getMediaDestDir();
        if (!fs.existsSync(mediaRoot)) fs.mkdirSync(mediaRoot, { recursive: true });

        let copiedPath = "";
        if (sourcePath && fs.existsSync(sourcePath)) {
          const ext = path.extname(sourcePath) || ".jpg";
          const destName = `${kind}_${record.dedupeKey.slice(-12)}${ext}`;
          copiedPath = path.join(mediaRoot, destName);
          if (!fs.existsSync(copiedPath)) {
            fs.copyFileSync(sourcePath, copiedPath);
          }
        }

        const result = db.prepare(`
          INSERT INTO media_assets (kind, file_path, source_path, category, copied_path, source, dedupe_key, created_at)
          VALUES (@kind, @filePath, @sourcePath, @category, @copiedPath, @source, @dedupeKey, @createdAt)
        `).run({
          kind,
          filePath: copiedPath || sourcePath,
          sourcePath,
          category: String(data.category ?? ""),
          copiedPath,
          source: String(data.source ?? record.sourceId),
          dedupeKey: record.dedupeKey,
          createdAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      case "vk_groups": {
        const vkUrl = normalizeGroupUrl(String(data.vkUrl ?? data.group_url ?? ""));
        const vkGroupId = String(data.vkGroupId ?? "");
        const result = db.prepare(`
          INSERT INTO groups (
            account_id, task_id, name, vk_url, vk_group_id, description, city, phone, status, created_at
          ) VALUES (
            @accountId, @taskId, @name, @vkUrl, @vkGroupId, @description, @city, @phone, @status, @createdAt
          )
        `).run({
          accountId: normalizeLogin(String(data.accountId ?? data.login ?? "")),
          taskId: data.taskId ? Number(data.taskId) : null,
          name: String(data.name ?? ""),
          vkUrl,
          vkGroupId,
          description: String(data.description ?? ""),
          city: normalizeCityName(String(data.city ?? "")),
          phone: normalizePhone(String(data.phone ?? "")),
          status: String(data.status ?? "imported"),
          createdAt: nowIso(),
        });
        refId = String(result.lastInsertRowid);
        break;
      }
      default:
        throw new Error(`Unknown entity: ${record.entity}`);
    }

    registerDedupeKey(record.dedupeKey, record.entity, refId);
    writeImportLog(runId, {
      sourceId: record.sourceId,
      entity: record.entity,
      action: "insert",
      dedupeKey: record.dedupeKey,
      message: `ref=${refId}`,
    }, dryRun);
    return "insert";
  } catch (error) {
    const message = error instanceof Error ? error.message : "apply error";
    writeImportLog(runId, {
      sourceId: record.sourceId,
      entity: record.entity,
      action: "error",
      dedupeKey: record.dedupeKey,
      message,
    }, dryRun);
    return "error";
  }
}

export function seedDedupeFromExisting(): void {
  const db = getVkAutomationDb();

  const accounts = db.prepare("SELECT id, login FROM accounts").all() as { id: string; login: string }[];
  for (const row of accounts) {
    if (row.login) registerDedupeKey(dedupeKeyAccount(row.login), "vk_accounts", row.id);
  }

  const cities = db.prepare("SELECT id, name FROM cities").all() as { id: number; name: string }[];
  for (const row of cities) {
    if (row.name) registerDedupeKey(`city:${normalizeCityName(row.name).toLowerCase()}`, "vk_cities", String(row.id));
  }

  const proxies = db.prepare("SELECT id, url FROM proxies").all() as { id: number; url: string }[];
  for (const row of proxies) {
    registerDedupeKey(`proxy:${normalizeProxyUrl(row.url).toLowerCase()}`, "vk_proxies", String(row.id));
  }

  const groups = db.prepare("SELECT id, vk_url FROM groups WHERE vk_url != ''").all() as { id: number; vk_url: string }[];
  for (const row of groups) {
    const key = `group:${normalizeGroupUrl(row.vk_url).toLowerCase()}`;
    registerDedupeKey(key, "vk_groups", String(row.id));
  }

  const keywords = db.prepare("SELECT id, dedupe_key FROM keywords").all() as { id: number; dedupe_key: string }[];
  for (const row of keywords) {
    registerDedupeKey(row.dedupe_key, "vk_keywords", String(row.id));
  }
}
