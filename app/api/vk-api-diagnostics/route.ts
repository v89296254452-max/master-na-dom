import { NextResponse } from "next/server";
import { getVkAccountById, readVkAccountsFile } from "@/lib/vk-accounts";
import { runVkApiDiagnostics } from "@/lib/vk-api-diagnostics";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";

    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId обязателен" }, { status: 400 });
    }

    const accounts = readVkAccountsFile();
    const account = getVkAccountById(accountId, accounts);

    if (!account) {
      return NextResponse.json({ success: false, error: "Аккаунт не найден" }, { status: 404 });
    }

    const result = await runVkApiDiagnostics(account);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить диагностику VK API";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
