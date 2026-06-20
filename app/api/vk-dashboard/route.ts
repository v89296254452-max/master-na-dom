import { NextResponse } from "next/server";
import { getVkDashboardData } from "@/lib/vk-dashboard";

export async function GET() {
  try {
    const dashboard = getVkDashboardData();
    return NextResponse.json({ success: true, dashboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить дашборд";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
