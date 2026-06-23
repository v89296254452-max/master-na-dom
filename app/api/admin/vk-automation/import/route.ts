import { NextResponse } from "next/server";
import { importOldVkDatabase } from "@/lib/vk-automation/import";

export async function POST() {
  try {
    const result = importOldVkDatabase();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Импорт не выполнен";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
