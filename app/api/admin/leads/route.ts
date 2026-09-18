import { NextResponse } from "next/server";
import { listLeads } from "@/lib/leads-store";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const result = listLeads({
      status: q.get("status") || undefined,
      service: q.get("service") || undefined,
      city: q.get("city") || undefined,
      limit: q.get("limit") ? parseInt(q.get("limit")!, 10) : undefined,
      offset: q.get("offset") ? parseInt(q.get("offset")!, 10) : undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
