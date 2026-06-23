/**
 * Унифицированный импорт VK-данных из всех источников проекта.
 * Env: VK_OLD_DATA_DIR, VK_AUTOMATION_DB_PATH
 * Flags: --dry-run, --sources=dm1_db,data_vk_tasks
 */

import fs from "fs";
import path from "path";
import { closeVkAutomationDb } from "../lib/vk-automation/db";
import { runImportAll } from "../lib/vk-automation/import-all";

function loadEnvFile(filename: string): void {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sourcesArg = args.find((a) => a.startsWith("--sources="));
const sourceIds = sourcesArg ? sourcesArg.replace("--sources=", "").split(",").filter(Boolean) : undefined;

async function main(): Promise<void> {
  console.log(`=== VK Import All ${dryRun ? "(dry-run)" : ""} ===`);

  const result = await runImportAll({ dryRun, sourceIds });

  console.log(`Run ID: ${result.runId}`);
  console.log(`Duration: ${result.durationMs}ms`);
  console.log(`Applied: ${result.applied}`);

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of result.warnings) console.log(`  - ${w}`);
  }

  console.log("\nEntities:");
  for (const entity of result.entities) {
    console.log(
      `  ${entity.entity}: total=${entity.total} new=${entity.new} skip=${entity.duplicate} errors=${entity.errors}`
    );
  }

  const errors = result.logs.filter((l) => l.action === "error");
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors.slice(0, 20)) {
      console.log(`  [${e.entity}] ${e.dedupeKey}: ${e.message}`);
    }
  }

  closeVkAutomationDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
