import { NextResponse } from "next/server";
import { getCoverageStats } from "@/lib/admin/coverage";

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...getCoverageStats() });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
