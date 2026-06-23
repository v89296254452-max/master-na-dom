import { NextResponse } from "next/server";
import {
  computeQueueStats,
  countTable,
  getKey,
  listAccounts,
  listCities,
  listGroups,
  listJobs,
  listLogEntries,
  listTasks,
} from "@/lib/vk-automation/db";
import { VK_AUTOMATION_CONFIG } from "@/lib/vk-automation/config";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      config: {
        dbPath: VK_AUTOMATION_CONFIG.dbPath,
        presetDir: VK_AUTOMATION_CONFIG.presetDir,
        oldDataDir: VK_AUTOMATION_CONFIG.oldDataDir,
        profilesDir: VK_AUTOMATION_CONFIG.profilesDir,
      },
      counts: {
        accounts: countTable("accounts"),
        cities: countTable("cities"),
        groups: countTable("groups"),
        tasks: countTable("tasks"),
        keys: countTable("keys"),
      },
      lastImportAt: getKey("last_import_at"),
      lastImportSource: getKey("last_import_source"),
      accounts: listAccounts(),
      cities: listCities(100),
      groups: listGroups(50),
      tasks: listTasks(50),
      jobs: listJobs(50),
      logs: listLogEntries(100),
      queueStats: computeQueueStats(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить данные";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
