import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { readTextLinesAutoEncoding, readTextFileAutoEncoding } from "./import-encoding";
import {
  dedupeKeyAccount,
  dedupeKeyCity,
  dedupeKeyCityService,
  dedupeKeyGroupUrl,
  dedupeKeyKeyword,
  dedupeKeyMedia,
  dedupeKeyPhone,
  dedupeKeyProxy,
  dedupeKeyTemplate,
  normalizeCityName,
  normalizeGroupUrl,
  normalizeKeyword,
  normalizeLogin,
  normalizePhone,
  normalizeServiceName,
  parseAccountLine,
} from "./import-normalize";
import type { VkImportEntity, VkImportRecord, VkImportSource, VkImportSourceKind } from "./import-types";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);

function projectRoot(): string {
  return process.cwd();
}

function resolveDm1Dir(): string {
  const candidates = [
    process.env.VK_OLD_DATA_DIR?.trim(),
    path.join(projectRoot(), "ДМ1"),
    path.join(projectRoot(), "DM1"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0] ?? path.join(projectRoot(), "ДМ1");
}

function fileMeta(filePath: string): Pick<VkImportSource, "exists" | "sizeBytes" | "lineCount"> {
  if (!fs.existsSync(filePath)) return { exists: false };
  const stat = fs.statSync(filePath);
  let lineCount: number | undefined;
  if (stat.size < 50 * 1024 * 1024) {
    try {
      lineCount = readTextLinesAutoEncoding(filePath).length;
    } catch {
      // binary
    }
  }
  return { exists: true, sizeBytes: stat.size, lineCount };
}

function makeSource(
  id: string,
  label: string,
  filePath: string,
  kind: VkImportSourceKind,
  entities: VkImportEntity[],
  note?: string
): VkImportSource {
  const meta = fileMeta(filePath);
  return {
    id,
    label,
    path: filePath,
    kind,
    entities,
    note,
    ...meta,
  };
}

export function discoverImportSources(): VkImportSource[] {
  const root = projectRoot();
  const dm1 = resolveDm1Dir();
  const preset = path.join(dm1, "Preset");
  const sources: VkImportSource[] = [];

  sources.push(
    makeSource("dm1_db", "ДМ1: vk_dors.db", path.join(dm1, "vk_dors.db"), "sqlite", [
      "vk_accounts",
      "vk_groups",
      "vk_cities",
      "vk_tasks",
      "vk_keywords",
      "vk_phones",
    ])
  );
  sources.push(
    makeSource("dm1_accounts", "ДМ1: account.txt", path.join(dm1, "account.txt"), "txt", ["vk_accounts"])
  );
  sources.push(
    makeSource("dm1_proxy", "ДМ1: proxy.txt", path.join(dm1, "proxy.txt"), "txt", ["vk_proxies"])
  );
  sources.push(
    makeSource("dm1_bad_proxy", "ДМ1: bad_proxy.txt", path.join(dm1, "bad_proxy.txt"), "txt", ["vk_proxies"], "bad")
  );
  sources.push(
    makeSource("dm1_cities", "ДМ1: города.txt", path.join(dm1, "города.txt"), "txt", ["vk_cities"])
  );
  sources.push(
    makeSource(
      "dm1_group_tpl",
      "ДМ1: Preset/groop_discription.txt",
      path.join(preset, "groop_discription.txt"),
      "txt",
      ["vk_group_templates"]
    )
  );
  sources.push(
    makeSource(
      "dm1_post_tpl",
      "ДМ1: Preset/post_discription.txt",
      path.join(preset, "post_discription.txt"),
      "txt",
      ["vk_post_templates"]
    )
  );
  sources.push(
    makeSource("dm1_keys", "ДМ1: Preset/key.txt", path.join(preset, "key.txt"), "txt", ["vk_keywords"])
  );
  sources.push(
    makeSource("dm1_oll_keys", "ДМ1: Preset/OLL_Key.txt", path.join(preset, "OLL_Key.txt"), "txt", ["vk_keywords"])
  );
  sources.push(
    makeSource("dm1_preset_xlsx", "ДМ1: Preset/preset.xlsx", path.join(preset, "preset.xlsx"), "xlsx", [
      "vk_group_templates",
      "vk_post_templates",
      "vk_keywords",
    ])
  );
  sources.push(
    makeSource("dm1_foto_label", "ДМ1: Preset/foto_label", path.join(preset, "foto_label"), "directory", [
      "vk_media_assets",
    ])
  );
  sources.push(
    makeSource("dm1_foto_posts", "ДМ1: Preset/foto_posts", path.join(preset, "foto_posts"), "directory", [
      "vk_media_assets",
    ])
  );
  sources.push(
    makeSource("dm1_foto_groops", "ДМ1: Preset/foto_groops", path.join(preset, "foto_groops"), "directory", [
      "vk_media_assets",
    ])
  );
  sources.push(
    makeSource("dm1_foto_add_posts", "ДМ1: Preset/foto_add_posts", path.join(preset, "foto_add_posts"), "directory", [
      "vk_media_assets",
    ])
  );
  sources.push(
    makeSource("dm1_check_foto", "ДМ1: check_foto_post.txt", path.join(preset, "check_foto_post.txt"), "txt", [
      "vk_groups",
      "vk_media_assets",
    ])
  );

  sources.push(
    makeSource("data_vk_accounts", "data/vk-accounts.json", path.join(root, "data", "vk-accounts.json"), "json", [
      "vk_accounts",
      "vk_phones",
    ])
  );
  sources.push(
    makeSource("data_vk_tasks", "data/vk-tasks.json", path.join(root, "data", "vk-tasks.json"), "json", [
      "vk_tasks",
      "vk_cities",
      "vk_services",
      "vk_phones",
      "vk_keywords",
      "vk_group_templates",
      "vk_post_templates",
    ])
  );
  sources.push(
    makeSource("data_vk_content", "data/vk-content-templates.json", path.join(root, "data", "vk-content-templates.json"), "json", [
      "vk_group_templates",
      "vk_post_templates",
    ])
  );
  sources.push(
    makeSource("data_vk_plan", "data/vk-plan.csv", path.join(root, "data", "vk-plan.csv"), "csv", [
      "vk_tasks",
      "vk_cities",
      "vk_services",
      "vk_phones",
      "vk_keywords",
      "vk_group_templates",
      "vk_post_templates",
    ])
  );
  sources.push(
    makeSource("public_vk_assets", "public/vk-assets", path.join(root, "public", "vk-assets"), "directory", [
      "vk_media_assets",
    ])
  );

  return sources;
}

function pickField(row: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim()) {
      return row[name];
    }
    const lower = name.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
  }
  return undefined;
}

function collectFromDm1Db(sourceId: string, dbPath: string): VkImportRecord[] {
  if (!fs.existsSync(dbPath)) return [];
  const db = new Database(dbPath, { readonly: true });
  const records: VkImportRecord[] = [];

  try {
    const accountRows = db.prepare("SELECT * FROM accounts").all() as Record<string, unknown>[];
    for (const row of accountRows) {
      const login = normalizeLogin(String(pickField(row, ["login"]) ?? ""));
      if (!login) continue;
      records.push({
        entity: "vk_accounts",
        dedupeKey: dedupeKeyAccount(login),
        sourceId,
        data: {
          id: String(pickField(row, ["id"]) ?? `acc_${login}`),
          login,
          password: String(pickField(row, ["password"]) ?? ""),
          proxy: String(pickField(row, ["proxy"]) ?? ""),
          status: String(pickField(row, ["status"]) ?? "active"),
        },
      });
    }

    const cityRows = db.prepare("SELECT * FROM citi").all() as Record<string, unknown>[];
    for (const row of cityRows) {
      const name = normalizeCityName(String(pickField(row, ["name", "citi"]) ?? ""));
      if (!name) continue;
      records.push({
        entity: "vk_cities",
        dedupeKey: dedupeKeyCity(name),
        sourceId,
        data: { name, region: String(pickField(row, ["location"]) ?? "") },
      });
    }

    const groupRows = db.prepare("SELECT * FROM groups").all() as Record<string, unknown>[];
    for (const row of groupRows) {
      const vkUrl = normalizeGroupUrl(String(pickField(row, ["group_url", "url"]) ?? ""));
      if (!vkUrl) continue;
      records.push({
        entity: "vk_groups",
        dedupeKey: dedupeKeyGroupUrl(vkUrl),
        sourceId,
        data: {
          login: String(pickField(row, ["login"]) ?? ""),
          vkUrl,
          name: String(pickField(row, ["name"]) ?? ""),
          city: String(pickField(row, ["citi", "city"]) ?? ""),
          phone: String(pickField(row, ["phone"]) ?? ""),
          status: String(pickField(row, ["status"]) ?? "imported"),
          description: String(pickField(row, ["description_post"]) ?? ""),
        },
      });
      const phone = normalizePhone(String(pickField(row, ["phone"]) ?? ""));
      if (phone) {
        records.push({
          entity: "vk_phones",
          dedupeKey: dedupeKeyPhone(phone),
          sourceId,
          data: { phone },
        });
      }
    }

    const taskRows = db.prepare("SELECT * FROM Tascks").all() as Record<string, unknown>[];
    for (const row of taskRows) {
      const cityRaw = String(pickField(row, ["citi", "city"]) ?? "");
      const service = normalizeServiceName(String(pickField(row, ["tematika", "service"]) ?? "сантехник"));
      const phone = normalizePhone(String(pickField(row, ["phone"]) ?? ""));
      if (cityRaw.toUpperCase() === "САНТЕХНИК" || !cityRaw) {
        records.push({
          entity: "vk_services",
          dedupeKey: `service:${service.toLowerCase()}`,
          sourceId,
          data: { name: service, category: String(pickField(row, ["tematika"]) ?? "") },
        });
      } else {
        const city = normalizeCityName(cityRaw);
        records.push({
          entity: "vk_tasks",
          dedupeKey: dedupeKeyCityService(city, service),
          sourceId,
          data: { city, service, phone, payload: row },
        });
      }
      if (phone) {
        records.push({
          entity: "vk_phones",
          dedupeKey: dedupeKeyPhone(phone),
          sourceId,
          data: { phone },
        });
      }
    }

    const keyRows = db.prepare("SELECT * FROM key").all() as Record<string, unknown>[];
    for (const row of keyRows) {
      const keyword = String(pickField(row, ["name", "keyword"]) ?? "");
      const city = normalizeCityName(String(pickField(row, ["citi", "city"]) ?? ""));
      const login = normalizeLogin(String(pickField(row, ["login"]) ?? ""));
      if (!keyword) continue;
      records.push({
        entity: "vk_keywords",
        dedupeKey: dedupeKeyKeyword(keyword, city),
        sourceId,
        data: { keyword, city, login },
      });
    }
  } finally {
    db.close();
  }

  return records;
}

function collectFromAccountTxt(sourceId: string, filePath: string, proxyFile?: string): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const proxies = proxyFile && fs.existsSync(proxyFile) ? readTextLinesAutoEncoding(proxyFile) : [];
  const lines = readTextLinesAutoEncoding(filePath);
  const records: VkImportRecord[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseAccountLine(lines[i], proxies[i] ?? proxies[0]);
    if (!parsed) continue;
    records.push({
      entity: "vk_accounts",
      dedupeKey: dedupeKeyAccount(parsed.login),
      sourceId,
      data: {
        id: `acc_${parsed.login}`,
        login: parsed.login,
        password: parsed.password,
        proxy: parsed.proxy,
        status: "active",
      },
    });
    if (parsed.proxy) {
      records.push({
        entity: "vk_proxies",
        dedupeKey: dedupeKeyProxy(parsed.proxy),
        sourceId,
        data: { url: parsed.proxy, status: "active" },
      });
    }
  }
  return records;
}

function collectFromProxyTxt(sourceId: string, filePath: string, status = "active"): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  return readTextLinesAutoEncoding(filePath).map((line) => ({
    entity: "vk_proxies" as const,
    dedupeKey: dedupeKeyProxy(line),
    sourceId,
    data: { url: line, status },
  }));
}

function collectFromCitiesTxt(sourceId: string, filePath: string): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const records: VkImportRecord[] = [];
  for (const line of readTextLinesAutoEncoding(filePath)) {
    const name = normalizeCityName(line);
    if (!name) continue;
    records.push({
      entity: "vk_cities",
      dedupeKey: dedupeKeyCity(name),
      sourceId,
      data: { name },
    });
  }
  return records;
}

function collectFromTextTemplate(
  sourceId: string,
  filePath: string,
  entity: "vk_group_templates" | "vk_post_templates",
  kind = "post"
): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const content = readTextFileAutoEncoding(filePath).trim();
  if (!content) return [];
  return [
    {
      entity,
      dedupeKey: dedupeKeyTemplate(content, entity),
      sourceId,
      data: { name: path.basename(filePath), content, kind },
    },
  ];
}

function collectFromKeywordTxt(sourceId: string, filePath: string): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const records: VkImportRecord[] = [];
  for (const line of readTextLinesAutoEncoding(filePath)) {
    const keyword = normalizeKeyword(line);
    if (!keyword) continue;
    records.push({
      entity: "vk_keywords",
      dedupeKey: dedupeKeyKeyword(keyword),
      sourceId,
      data: { keyword: line.trim() },
    });
  }
  return records;
}

function collectFromImageDir(
  sourceId: string,
  dirPath: string,
  kind: string,
  category = ""
): VkImportRecord[] {
  if (!fs.existsSync(dirPath)) return [];
  const records: VkImportRecord[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;
      records.push({
        entity: "vk_media_assets",
        dedupeKey: dedupeKeyMedia(full),
        sourceId,
        data: { kind, sourcePath: full, category: category || path.basename(dir) },
      });
    }
  };

  walk(dirPath);
  return records;
}

function collectFromCheckFotoPost(sourceId: string, filePath: string): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const records: VkImportRecord[] = [];
  const dm1 = resolveDm1Dir();

  for (const line of readTextLinesAutoEncoding(filePath)) {
    const [urlPart, filePart] = line.split("|").map((s) => s.trim());
    if (urlPart) {
      const vkUrl = normalizeGroupUrl(urlPart);
      records.push({
        entity: "vk_groups",
        dedupeKey: dedupeKeyGroupUrl(vkUrl),
        sourceId,
        data: { vkUrl, name: path.basename(filePart ?? "", ".jpg") },
      });
    }
    if (filePart) {
      const imgPath = path.join(dm1, "Preset", "foto_add_posts", filePart);
      if (fs.existsSync(imgPath)) {
        records.push({
          entity: "vk_media_assets",
          dedupeKey: dedupeKeyMedia(imgPath),
          sourceId,
          data: { kind: "post", sourcePath: imgPath, category: "foto_add_posts" },
        });
      }
    }
  }
  return records;
}

function collectFromVkAccountsJson(sourceId: string, filePath: string): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  if (!Array.isArray(raw)) return [];
  const records: VkImportRecord[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const phone = normalizePhone(String(row.phone ?? ""));
    const login = normalizeLogin(phone.replace(/\D/g, "").slice(-11) || String(row.id ?? ""));
    if (login) {
      records.push({
        entity: "vk_accounts",
        dedupeKey: dedupeKeyAccount(login),
        sourceId,
        data: {
          id: String(row.id ?? `acc_${login}`),
          login,
          password: "",
          proxy: "",
          status: String(row.status ?? "active"),
          name: String(row.name ?? ""),
          phone,
        },
      });
    }
    if (phone) {
      records.push({
        entity: "vk_phones",
        dedupeKey: dedupeKeyPhone(phone),
        sourceId,
        data: { phone },
      });
    }
  }
  return records;
}

function collectFromVkTasksJson(sourceId: string, filePath: string): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  if (!Array.isArray(raw)) return [];
  const records: VkImportRecord[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const city = normalizeCityName(String(row.city ?? ""));
    const service = normalizeServiceName(String(row.service ?? ""));
    const phone = normalizePhone(String(row.phone ?? ""));

    if (city) {
      records.push({
        entity: "vk_cities",
        dedupeKey: dedupeKeyCity(city),
        sourceId,
        data: { name: city },
      });
    }
    if (service) {
      records.push({
        entity: "vk_services",
        dedupeKey: `service:${service.toLowerCase()}`,
        sourceId,
        data: { name: service, slug: String(row.slug ?? ""), category: String(row.accountGroup ?? "") },
      });
    }
    if (city && service) {
      records.push({
        entity: "vk_tasks",
        dedupeKey: dedupeKeyCityService(city, service),
        sourceId,
        data: {
          city,
          service,
          phone,
          groupName: String(row.vkName ?? ""),
          vkName: String(row.vkName ?? ""),
          payload: row,
        },
      });
    }
    if (phone) {
      records.push({
        entity: "vk_phones",
        dedupeKey: dedupeKeyPhone(phone),
        sourceId,
        data: { phone },
      });
    }
    const keywords = String(row.vkKeywords ?? "");
    if (keywords) {
      for (const kw of keywords.split(",").map((s) => s.trim()).filter(Boolean)) {
        records.push({
          entity: "vk_keywords",
          dedupeKey: dedupeKeyKeyword(kw, city, service),
          sourceId,
          data: { keyword: kw, city, service },
        });
      }
    }
    const desc = String(row.vkDescription ?? "");
    if (desc) {
      records.push({
        entity: "vk_group_templates",
        dedupeKey: dedupeKeyTemplate(desc, `vk_task_desc_${String(row.id ?? "")}`),
        sourceId,
        data: { name: String(row.vkName ?? row.id ?? ""), content: desc },
      });
    }
    const post = String(row.vkFirstPost ?? "");
    if (post) {
      records.push({
        entity: "vk_post_templates",
        dedupeKey: dedupeKeyTemplate(post, `vk_task_post_${String(row.id ?? "")}`),
        sourceId,
        data: { name: String(row.vkName ?? row.id ?? ""), content: post, kind: "pinned" },
      });
    }
  }
  return records;
}

function collectFromContentTemplatesJson(sourceId: string, filePath: string): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  const records: VkImportRecord[] = [];

  for (const [groupKey, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const tpl = value as Record<string, unknown>;
    const descriptions = Array.isArray(tpl.descriptions) ? tpl.descriptions : [];
    const pinned = Array.isArray(tpl.pinnedPosts) ? tpl.pinnedPosts : [];
    const posts = Array.isArray(tpl.posts) ? tpl.posts : [];

    for (const content of descriptions) {
      const text = String(content);
      records.push({
        entity: "vk_group_templates",
        dedupeKey: dedupeKeyTemplate(text, `content_desc_${groupKey}`),
        sourceId,
        data: { name: groupKey, content: text },
      });
    }
    for (const content of pinned) {
      const text = String(content);
      records.push({
        entity: "vk_post_templates",
        dedupeKey: dedupeKeyTemplate(text, `content_pinned_${groupKey}`),
        sourceId,
        data: { name: groupKey, content: text, kind: "pinned" },
      });
    }
    for (const content of posts) {
      const text = String(content);
      records.push({
        entity: "vk_post_templates",
        dedupeKey: dedupeKeyTemplate(text, `content_post_${groupKey}`),
        sourceId,
        data: { name: groupKey, content: text, kind: "post" },
      });
    }
  }
  return records;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function collectFromVkPlanCsv(sourceId: string, filePath: string): VkImportRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const content = readTextFileAutoEncoding(filePath);
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const records: VkImportRecord[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });

    const city = normalizeCityName(row.city ?? "");
    const service = normalizeServiceName(row.service ?? "");
    const phone = normalizePhone(row.phone ?? "");

    if (city) {
      records.push({ entity: "vk_cities", dedupeKey: dedupeKeyCity(city), sourceId, data: { name: city } });
    }
    if (service) {
      records.push({
        entity: "vk_services",
        dedupeKey: `service:${service.toLowerCase()}`,
        sourceId,
        data: { name: service, slug: row.slug ?? "", category: row.accountGroup ?? "" },
      });
    }
    if (city && service) {
      records.push({
        entity: "vk_tasks",
        dedupeKey: dedupeKeyCityService(city, service),
        sourceId,
        data: { city, service, phone, groupName: row.vkName ?? "", payload: row },
      });
    }
    if (phone) {
      records.push({ entity: "vk_phones", dedupeKey: dedupeKeyPhone(phone), sourceId, data: { phone } });
    }
    const keywords = row.vkKeywords ?? "";
    for (const kw of keywords.split(",").map((s) => s.trim()).filter(Boolean)) {
      records.push({
        entity: "vk_keywords",
        dedupeKey: dedupeKeyKeyword(kw, city, service),
        sourceId,
        data: { keyword: kw, city, service },
      });
    }
    if (row.vkDescription) {
      records.push({
        entity: "vk_group_templates",
        dedupeKey: dedupeKeyTemplate(row.vkDescription, `plan_desc_${row.slug ?? i}`),
        sourceId,
        data: { name: row.vkName ?? row.slug ?? "", content: row.vkDescription },
      });
    }
    if (row.vkFirstPost) {
      records.push({
        entity: "vk_post_templates",
        dedupeKey: dedupeKeyTemplate(row.vkFirstPost, `plan_post_${row.slug ?? i}`),
        sourceId,
        data: { name: row.vkName ?? row.slug ?? "", content: row.vkFirstPost, kind: "pinned" },
      });
    }
  }
  return records;
}

async function collectFromPresetXlsx(sourceId: string, filePath: string): Promise<VkImportRecord[]> {
  if (!fs.existsSync(filePath)) return [];
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
    const records: VkImportRecord[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
          const text = String(value ?? "").trim();
          if (!text || text.length < 10) continue;
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("desc") || lowerKey.includes("опис")) {
            records.push({
              entity: "vk_group_templates",
              dedupeKey: dedupeKeyTemplate(text, `xlsx_${sheetName}_${key}`),
              sourceId,
              data: { name: `${sheetName}:${key}`, content: text },
            });
          } else if (lowerKey.includes("post") || lowerKey.includes("пост")) {
            records.push({
              entity: "vk_post_templates",
              dedupeKey: dedupeKeyTemplate(text, `xlsx_${sheetName}_${key}`),
              sourceId,
              data: { name: `${sheetName}:${key}`, content: text, kind: "post" },
            });
          } else if (lowerKey.includes("key") || lowerKey.includes("ключ")) {
            records.push({
              entity: "vk_keywords",
              dedupeKey: dedupeKeyKeyword(text),
              sourceId,
              data: { keyword: text },
            });
          }
        }
      }
    }
    return records;
  } catch {
    return [];
  }
}

export async function collectRecordsForSource(source: VkImportSource): Promise<VkImportRecord[]> {
  switch (source.id) {
    case "dm1_db":
      return collectFromDm1Db(source.id, source.path);
    case "dm1_accounts":
      return collectFromAccountTxt(source.id, source.path, path.join(path.dirname(source.path), "proxy.txt"));
    case "dm1_proxy":
      return collectFromProxyTxt(source.id, source.path);
    case "dm1_bad_proxy":
      return collectFromProxyTxt(source.id, source.path, "bad");
    case "dm1_cities":
      return collectFromCitiesTxt(source.id, source.path);
    case "dm1_group_tpl":
      return collectFromTextTemplate(source.id, source.path, "vk_group_templates");
    case "dm1_post_tpl":
      return collectFromTextTemplate(source.id, source.path, "vk_post_templates", "post");
    case "dm1_keys":
    case "dm1_oll_keys":
      return collectFromKeywordTxt(source.id, source.path);
    case "dm1_preset_xlsx":
      return collectFromPresetXlsx(source.id, source.path);
    case "dm1_foto_label":
      return [
        ...collectFromImageDir(source.id, source.path, "avatar", "foto_label"),
        ...collectFromImageDir(source.id, source.path, "cover", "foto_label"),
      ];
    case "dm1_foto_posts":
      return collectFromImageDir(source.id, source.path, "post", "foto_posts");
    case "dm1_foto_groops":
      return collectFromImageDir(source.id, source.path, "group_cover", "foto_groops");
    case "dm1_foto_add_posts":
      return collectFromImageDir(source.id, source.path, "post", "foto_add_posts");
    case "dm1_check_foto":
      return collectFromCheckFotoPost(source.id, source.path);
    case "data_vk_accounts":
      return collectFromVkAccountsJson(source.id, source.path);
    case "data_vk_tasks":
      return collectFromVkTasksJson(source.id, source.path);
    case "data_vk_content":
      return collectFromContentTemplatesJson(source.id, source.path);
    case "data_vk_plan":
      return collectFromVkPlanCsv(source.id, source.path);
    case "public_vk_assets":
      return [
        ...collectFromImageDir(source.id, path.join(source.path, "avatars"), "avatar", "public"),
        ...collectFromImageDir(source.id, path.join(source.path, "covers"), "cover", "public"),
        ...collectFromImageDir(source.id, path.join(source.path, "posts"), "post", "public"),
      ];
    default:
      return [];
  }
}

export async function collectAllImportRecords(sourceIds?: string[]): Promise<VkImportRecord[]> {
  const sources = discoverImportSources().filter((s) => s.exists);
  const selected = sourceIds?.length
    ? sources.filter((s) => sourceIds.includes(s.id))
    : sources;

  const all: VkImportRecord[] = [];
  const seenInBatch = new Set<string>();

  for (const source of selected) {
    const records = await collectRecordsForSource(source);
    for (const record of records) {
      if (seenInBatch.has(record.dedupeKey)) continue;
      seenInBatch.add(record.dedupeKey);
      all.push(record);
    }
  }
  return all;
}
