/**
 * Импорт данных из старой ZennoPoster базы vk_dors.db и текстовых файлов ДМ1.
 * Env: VK_OLD_DATA_DIR, VK_OLD_DB_PATH, VK_PRESET_DIR
 */

import fs from "fs";
import path from "path";
import { importOldVkDatabase } from "../lib/vk-automation/import";
import { closeVkAutomationDb } from "../lib/vk-automation/db";

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

const result = importOldVkDatabase();

console.log("=== VK Old DB Import ===");
console.log(`Accounts: ${result.accounts}`);
console.log(`Groups:   ${result.groups}`);
console.log(`Cities:   ${result.cities}`);
console.log(`Tasks:    ${result.tasks}`);
console.log(`Keys:     ${result.keys}`);

if (result.warnings.length > 0) {
  console.log("\nWarnings:");
  for (const w of result.warnings) {
    console.log(`  - ${w}`);
  }
}

closeVkAutomationDb();
