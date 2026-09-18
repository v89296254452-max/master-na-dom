import { NextResponse } from "next/server";
import { getCampaignStats } from "@/lib/leads-store";

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...getCampaignStats() });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
