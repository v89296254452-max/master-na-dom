import { NextResponse } from "next/server";
import { enqueueAuthCheck, enqueueAuthOpen } from "@/lib/vk-automation/queue";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await context.params;
    const body = await request.json();
    const action = body.action as string;

    if (action === "open") {
      const job = enqueueAuthOpen(accountId);
      return NextResponse.json({
        success: true,
        job,
        message: "Задача авторизации создана. Запустите npm run vk:worker",
      });
    }

    if (action === "check") {
      const job = enqueueAuthCheck(accountId);
      return NextResponse.json({
        success: true,
        job,
        message: "Задача проверки создана. Запустите npm run vk:worker",
      });
    }

    return NextResponse.json({ success: false, error: "action: open или check" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
