import crypto from "crypto";
import { getVkAutomationDb } from "./db";
import { collectAllImportRecords, discoverImportSources } from "./import-sources";
import { applyImportRecord, hasDedupeKey, seedDedupeFromExisting } from "./import-store";
import type {
  VkImportEntity,
  VkImportEntityPreview,
  VkImportAction,
  VkImportLogEntry,
  VkImportPreviewResult,
  VkImportRunResult,
  VkImportRecord,
} from "./import-types";
import { VK_IMPORT_ENTITY_LABELS } from "./import-types";

export interface ImportAllOptions {
  dryRun?: boolean;
  sourceIds?: string[];
  seedExisting?: boolean;
}

function createRunId(): string {
  return `import_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function processRecords(
  runId: string,
  records: VkImportRecord[],
  dryRun: boolean,
  sessionSeen: Set<string>
): VkImportLogEntry[] {
  const logs: VkImportLogEntry[] = [];

  for (const record of records) {
    if (sessionSeen.has(record.dedupeKey) || hasDedupeKey(record.dedupeKey)) {
      logs.push({
        sourceId: record.sourceId,
        entity: record.entity,
        action: "skip",
        dedupeKey: record.dedupeKey,
        message: "Дубликат",
      });
      continue;
    }

    const action = applyImportRecord(runId, record, dryRun);
    logs.push({
      sourceId: record.sourceId,
      entity: record.entity,
      action,
      dedupeKey: record.dedupeKey,
      message: action,
    });

    if (action === "insert") {
      sessionSeen.add(record.dedupeKey);
    }
  }

  return logs;
}

function buildEntityPreviews(
  records: VkImportRecord[],
  logs: VkImportLogEntry[]
): VkImportEntityPreview[] {
  const entities = Object.keys(VK_IMPORT_ENTITY_LABELS) as VkImportEntity[];
  const previews: VkImportEntityPreview[] = [];

  for (const entity of entities) {
    const entityRecords = records.filter((r) => r.entity === entity);
    const entityLogs = logs.filter((l) => l.entity === entity);

    previews.push({
      entity,
      total: entityRecords.length,
      new: entityLogs.filter((l) => l.action === "insert").length,
      duplicate: entityLogs.filter((l) => l.action === "skip").length,
      updated: entityLogs.filter((l) => l.action === "update").length,
      errors: entityLogs.filter((l) => l.action === "error").length,
      samples: entityRecords.slice(0, 3).map((r) => r.data),
    });
  }

  return previews.filter((p) => p.total > 0);
}

export async function previewImportAll(options: ImportAllOptions = {}): Promise<VkImportPreviewResult> {
  getVkAutomationDb();
  const runId = createRunId();
  const warnings: string[] = [];

  seedDedupeFromExisting();
  const sessionSeen = new Set<string>();

  const sources = discoverImportSources();
  if (!sources.some((s) => s.id === "dm1_db" && s.exists)) {
    warnings.push("ДМ1/vk_dors.db не найден — ZennoPoster SQLite будет пропущен");
  }

  const records = await collectAllImportRecords(options.sourceIds);
  const logs = processRecords(runId, records, true, sessionSeen);

  return {
    runId,
    dryRun: true,
    sources,
    entities: buildEntityPreviews(records, logs),
    warnings,
    logs: logs.slice(0, 500),
  };
}

export async function runImportAll(options: ImportAllOptions = {}): Promise<VkImportRunResult> {
  const start = Date.now();
  getVkAutomationDb();
  const runId = createRunId();
  const dryRun = options.dryRun === true;
  const warnings: string[] = [];

  seedDedupeFromExisting();
  const sessionSeen = new Set<string>();

  const sources = discoverImportSources();
  const records = await collectAllImportRecords(options.sourceIds);
  const logs = processRecords(runId, records, dryRun, sessionSeen);

  return {
    runId,
    dryRun,
    applied: !dryRun,
    durationMs: Date.now() - start,
    sources,
    entities: buildEntityPreviews(records, logs),
    warnings,
    logs: logs.slice(0, 1000),
  };
}
