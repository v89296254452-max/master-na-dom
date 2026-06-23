import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { VK_AUTOMATION_CONFIG } from "./config";
import {
  bulkInsertCities,
  getVkAutomationDb,
  setKey,
  upsertAccount,
} from "./db";

export interface ImportOldDbResult {
  accounts: number;
  groups: number;
  cities: number;
  tasks: number;
  keys: number;
  warnings: string[];
}

function readTextLines(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function parseAccountLine(line: string, proxy?: string): { login: string; password: string; proxy: string } | null {
  const separators = [":", ";", "|", "\t"];
  for (const sep of separators) {
    if (line.includes(sep)) {
      const parts = line.split(sep);
      const login = parts[0]?.trim();
      const password = parts[1]?.trim() ?? "";
      if (login) {
        return { login, password, proxy: proxy ?? parts[2]?.trim() ?? "" };
      }
    }
  }
  return null;
}

function importFromTextFiles(dataDir: string, warnings: string[]): { accounts: number; cities: number } {
  let accounts = 0;
  let cities = 0;

  const accountFile = path.join(dataDir, "account.txt");
  const proxyFile = path.join(dataDir, "proxy.txt");
  const citiesFile = path.join(dataDir, "города.txt");

  const proxies = readTextLines(proxyFile);
  const accountLines = readTextLines(accountFile);

  for (let i = 0; i < accountLines.length; i += 1) {
    const proxy = proxies[i] ?? proxies[0] ?? "";
    const parsed = parseAccountLine(accountLines[i], proxy);
    if (!parsed) {
      warnings.push(`account.txt line ${i + 1}: не распознан формат`);
      continue;
    }

    const id = `acc_${parsed.login.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    upsertAccount({
      id,
      login: parsed.login,
      password: parsed.password,
      proxy: parsed.proxy,
    });
    accounts += 1;
  }

  const cityNames = readTextLines(citiesFile);
  if (cityNames.length > 0) {
    cities = bulkInsertCities(cityNames);
  }

  return { accounts, cities };
}

function importTableRows(
  oldDb: Database.Database,
  tableName: string
): Record<string, unknown>[] {
  try {
    return oldDb.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, unknown>[];
  } catch {
    return [];
  }
}

function pickField(row: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim()) {
      return row[name];
    }
    const lower = name.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) {
        return row[key];
      }
    }
  }
  return undefined;
}

export function importOldVkDatabase(): ImportOldDbResult {
  const warnings: string[] = [];
  const result: ImportOldDbResult = {
    accounts: 0,
    groups: 0,
    cities: 0,
    tasks: 0,
    keys: 0,
    warnings,
  };

  getVkAutomationDb();

  const dataDir = VK_AUTOMATION_CONFIG.oldDataDir;
  if (dataDir && fs.existsSync(dataDir)) {
    const fromText = importFromTextFiles(dataDir, warnings);
    result.accounts += fromText.accounts;
    result.cities += fromText.cities;
  }

  const oldDbPath =
    VK_AUTOMATION_CONFIG.oldDbPath ||
    (dataDir ? path.join(dataDir, "vk_dors.db") : "");

  if (!oldDbPath || !fs.existsSync(oldDbPath)) {
    if (!result.accounts && !result.cities) {
      warnings.push(`vk_dors.db не найден: ${oldDbPath || "(путь не задан)"}`);
    }
    setKey("last_import_at", new Date().toISOString());
    return result;
  }

  const oldDb = new Database(oldDbPath, { readonly: true });
  const db = getVkAutomationDb();

  const accountRows = importTableRows(oldDb, "accounts");
  for (const row of accountRows) {
    const login = String(pickField(row, ["login", "Login", "email", "user"]) ?? "").trim();
    if (!login) continue;
    const id = String(pickField(row, ["id", "Id", "ID"]) ?? `acc_${login.replace(/[^a-zA-Z0-9_]/g, "_")}`);
    upsertAccount({
      id,
      login,
      password: String(pickField(row, ["password", "pass", "Password"]) ?? ""),
      proxy: String(pickField(row, ["proxy", "Proxy"]) ?? ""),
      status: "active",
    });
    result.accounts += 1;
  }

  const cityRows = importTableRows(oldDb, "citi");
  const cityNames = cityRows
    .map((row) => String(pickField(row, ["name", "city", "citi", "title"]) ?? "").trim())
    .filter(Boolean);
  if (cityNames.length > 0) {
    result.cities += bulkInsertCities(cityNames);
  }

  const groupRows = importTableRows(oldDb, "groups");
  for (const row of groupRows) {
    const name = String(pickField(row, ["name", "title", "group_name"]) ?? "");
    const vkUrl = String(pickField(row, ["url", "vk_url", "link"]) ?? "");
    const accountId = String(pickField(row, ["account_id", "account", "acc"]) ?? "");
    db.prepare(`
      INSERT INTO groups (account_id, task_id, name, vk_url, vk_group_id, description, city, phone, status, created_at)
      VALUES (@accountId, NULL, @name, @vkUrl, @vkGroupId, @description, @city, @phone, @status, @createdAt)
    `).run({
      accountId,
      name,
      vkUrl,
      vkGroupId: String(pickField(row, ["vk_group_id", "group_id", "id"]) ?? ""),
      description: String(pickField(row, ["description", "desc"]) ?? ""),
      city: String(pickField(row, ["city", "citi"]) ?? ""),
      phone: String(pickField(row, ["phone", "tel"]) ?? ""),
      status: String(pickField(row, ["status"]) ?? "imported"),
      createdAt: new Date().toISOString(),
    });
    result.groups += 1;
  }

  const taskTableNames = ["Tascks", "tasks", "Tasks"];
  let taskRows: Record<string, unknown>[] = [];
  for (const table of taskTableNames) {
    taskRows = importTableRows(oldDb, table);
    if (taskRows.length > 0) break;
  }

  for (const row of taskRows) {
    const accountId = String(pickField(row, ["account_id", "account", "acc"]) ?? "");
    const groupName = String(pickField(row, ["group_name", "name", "title"]) ?? "");
    const phone = String(pickField(row, ["phone", "tel"]) ?? "");
    const cityId = pickField(row, ["city_id", "citi_id", "city"]);
    db.prepare(`
      INSERT INTO tasks (account_id, city_id, phone, group_name, status, payload, error_message, created_at, updated_at)
      VALUES (@accountId, @cityId, @phone, @groupName, 'pending', @payload, '', @createdAt, @updatedAt)
    `).run({
      accountId,
      cityId: cityId !== undefined ? Number(cityId) : null,
      phone,
      groupName,
      payload: JSON.stringify(row),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    result.tasks += 1;
  }

  const keyRows = importTableRows(oldDb, "key");
  for (const row of keyRows) {
    const key = String(pickField(row, ["key", "name", "id"]) ?? "");
    const value = String(pickField(row, ["value", "val", "data"]) ?? "");
    if (key) {
      setKey(key, value);
      result.keys += 1;
    }
  }

  oldDb.close();
  setKey("last_import_at", new Date().toISOString());
  setKey("last_import_source", oldDbPath);

  return result;
}
