import { NextResponse } from "next/server";
import { listLogEntries } from "@/lib/vk-automation/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(500, Number(url.searchParams.get("limit")) || 200);
    const logs = listLogEntries(limit);
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить лог";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
