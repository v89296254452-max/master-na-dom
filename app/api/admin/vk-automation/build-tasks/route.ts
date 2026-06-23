import { NextResponse } from "next/server";
import { buildAndEnqueueGroupTasks } from "@/lib/master-data/build-task";
import { getMasterDataSource } from "@/lib/master-data/source";
import type { VkAccountGroup } from "@/lib/vk-types";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number(body.limit) || 20;
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : undefined;
    const offerGroup = body.offerGroup as VkAccountGroup | "all" | undefined;

    const result = buildAndEnqueueGroupTasks({
      limit,
      accountId,
      offerGroup: offerGroup ?? "all",
      source: getMasterDataSource(),
      onlyWithoutGroup: true,
    });

    const parts = [
      `Создано ${result.created} заданий, пропущено ${result.skipped}.`,
      result.errors.length > 0 ? `Ошибки: ${result.errors.join("; ")}` : "",
      "Запустите npm run vk:worker",
    ].filter(Boolean);

    return NextResponse.json({
      success: true,
      result,
      message: parts.join(" "),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось собрать задачи";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
