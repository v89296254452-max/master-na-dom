import { NextResponse } from "next/server";
import { getVkTaskStatusSnapshot } from "@/lib/vk-task-status-server";

export async function GET() {
  try {
    const status = getVkTaskStatusSnapshot();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить статусы задач";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
