import { NextResponse } from "next/server";
import { getRecentVkUrlBindBatches, getVkUrlBindBatchById } from "@/lib/vk-url-bind-batches";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const batchId = url.searchParams.get("batchId")?.trim() ?? "";

    if (batchId) {
      const batch = getVkUrlBindBatchById(batchId);
      if (!batch) {
        return NextResponse.json({ success: false, error: "batchId не найден" }, { status: 404 });
      }
      return NextResponse.json({ success: true, batch });
    }

    const batches = getRecentVkUrlBindBatches(10);
    return NextResponse.json({ success: true, batches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить batches";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
