import { NextResponse } from "next/server";
import { getContentStats } from "@/lib/admin/content-stats";
import { getLeadsStats } from "@/lib/leads-store";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      content: await getContentStats(),
      leads: getLeadsStats(),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
