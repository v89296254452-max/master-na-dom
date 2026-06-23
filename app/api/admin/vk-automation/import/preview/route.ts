import { NextResponse } from "next/server";
import { previewImportAll } from "@/lib/vk-automation/import-all";
import { discoverImportSources } from "@/lib/vk-automation/import-sources";
import { listImportLogs } from "@/lib/vk-automation/import-store";
import { VK_IMPORT_ENTITY_LABELS } from "@/lib/vk-automation/import-types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sourceIds = url.searchParams.get("sources")?.split(",").filter(Boolean);
    const preview = await previewImportAll({ sourceIds });

    return NextResponse.json({
      success: true,
      entityLabels: VK_IMPORT_ENTITY_LABELS,
      sources: discoverImportSources(),
      preview,
      recentLogs: listImportLogs(undefined, 100),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка предпросмотра";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
