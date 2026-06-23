import { NextResponse } from "next/server";
import {
  getMasterDataSource,
  setMasterDataSource,
  getActiveSourceLabel,
  getMasterDataSourcesReport,
  MASTER_DATA_SOURCE_LABELS,
  MASTER_DATA_SOURCES,
} from "@/lib/master-data";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      source: getMasterDataSource(),
      sourceLabel: getActiveSourceLabel(),
      sources: MASTER_DATA_SOURCES.map((id) => ({
        id,
        label: MASTER_DATA_SOURCE_LABELS[id],
      })),
      report: getMasterDataSourcesReport(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const source = body.source as string;
    if (source !== "project" && source !== "legacy") {
      return NextResponse.json({ success: false, error: "source: project | legacy" }, { status: 400 });
    }
    setMasterDataSource(source);
    return NextResponse.json({
      success: true,
      source,
      sourceLabel: getActiveSourceLabel(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
