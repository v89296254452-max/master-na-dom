import { NextResponse } from "next/server";
import { checkAccountAuthTechnical } from "@/lib/vk-account-auth";
import {
  getVkAccountById,
  readVkAccountsFile,
  upsertVkAccount,
  writeVkAccountsFile,
} from "@/lib/vk-accounts";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";

    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId обязателен" }, { status: 400 });
    }

    const accounts = readVkAccountsFile();
    const existing = getVkAccountById(accountId, accounts);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Аккаунт не найден" }, { status: 404 });
    }

    const updated = checkAccountAuthTechnical(existing);
    upsertVkAccount(accounts, updated);
    writeVkAccountsFile(accounts);

    return NextResponse.json({
      success: true,
      account: updated,
      message:
        updated.authStatus === "connected"
          ? "Авторизация подтверждена (техническая проверка)"
          : updated.lastAuthError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось проверить авторизацию";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
