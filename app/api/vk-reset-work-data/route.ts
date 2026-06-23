import { NextResponse } from "next/server";
import { resetWorkData } from "@/lib/vk-work-data-reset";

export async function POST() {
  try {
    const result = resetWorkData();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сбросить рабочие данные";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
