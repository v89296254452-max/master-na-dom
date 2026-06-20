import { NextResponse } from "next/server";
import type { VkAccount, VkAccountStatus } from "@/lib/vk-account-types";
import { DEFAULT_VK_ACCOUNT_AUTH, VK_ACCOUNT_STATUSES } from "@/lib/vk-account-types";
import {
  deleteVkAccount,
  ensureVkAccountsFile,
  getVkAccountById,
  getVkAccountsWithStats,
  readVkAccountsFile,
  upsertVkAccount,
  writeVkAccountsFile,
} from "@/lib/vk-accounts";

function isAccountStatus(value: unknown): value is VkAccountStatus {
  return typeof value === "string" && VK_ACCOUNT_STATUSES.includes(value as VkAccountStatus);
}

function toNumber(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function parseAccountInput(body: Record<string, unknown>, existing?: VkAccount): VkAccount | null {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return null;

  const base: VkAccount = {
    id,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : id,
    phone: typeof body.phone === "string" ? body.phone.trim() : "",
    status: isAccountStatus(body.status) ? body.status : "active",
    dailyLimit: toNumber(body.dailyLimit, 10),
    totalLimit: toNumber(body.totalLimit, 50),
    notes: typeof body.notes === "string" ? body.notes.trim() : "",
    ...DEFAULT_VK_ACCOUNT_AUTH,
  };

  if (existing) {
    return {
      ...base,
      authStatus: existing.authStatus,
      vkUserId: existing.vkUserId,
      vkProfileUrl: existing.vkProfileUrl,
      accessToken: existing.accessToken,
      tokenExpiresAt: existing.tokenExpiresAt,
      lastAuthCheckAt: existing.lastAuthCheckAt,
      lastAuthError: existing.lastAuthError,
    };
  }

  return base;
}

export async function GET() {
  try {
    ensureVkAccountsFile();
    const accounts = getVkAccountsWithStats();
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить аккаунты";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const accounts = readVkAccountsFile();
    const existing = id ? getVkAccountById(id, accounts) : undefined;
    const account = parseAccountInput(body as Record<string, unknown>, existing);

    if (!account) {
      return NextResponse.json({ success: false, error: "id обязателен" }, { status: 400 });
    }

    const saved = upsertVkAccount(accounts, account);
    writeVkAccountsFile(accounts);

    return NextResponse.json({ success: true, account: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить аккаунт";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id")?.trim() ?? "";

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = typeof body.id === "string" ? body.id.trim() : "";
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "id обязателен" }, { status: 400 });
    }

    const accounts = readVkAccountsFile();
    const deleted = deleteVkAccount(accounts, id);

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Аккаунт не найден" }, { status: 404 });
    }

    writeVkAccountsFile(accounts);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить аккаунт";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
