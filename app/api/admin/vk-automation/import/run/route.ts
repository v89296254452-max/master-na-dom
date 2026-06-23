import { NextResponse } from "next/server";
import { runImportAll } from "@/lib/vk-automation/import-all";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    const sourceIds = Array.isArray(body.sourceIds)
      ? body.sourceIds.filter((id: unknown) => typeof id === "string")
      : undefined;

    const result = await runImportAll({ dryRun, sourceIds });

    return NextResponse.json({
      success: true,
      result,
      message: dryRun
        ? "Dry-run завершён (данные не изменены)"
        : `Импорт выполнен за ${result.durationMs}ms`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Импорт не выполнен";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
