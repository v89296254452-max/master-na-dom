import { NextResponse } from "next/server";
import {
  checkAccountAuthTechnical,
  saveAccountAuthFields,
} from "@/lib/vk-account-auth";
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
    const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
    const vkUserId = typeof body.vkUserId === "string" ? body.vkUserId : "";

    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId обязателен" }, { status: 400 });
    }

    if (!accessToken.trim()) {
      return NextResponse.json({ success: false, error: "accessToken обязателен" }, { status: 400 });
    }

    const accounts = readVkAccountsFile();
    const existing = getVkAccountById(accountId, accounts);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Аккаунт не найден" }, { status: 404 });
    }

    const updated = saveAccountAuthFields(existing, accessToken, vkUserId);
    upsertVkAccount(accounts, updated);
    writeVkAccountsFile(accounts);

    return NextResponse.json({ success: true, account: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить токен";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
