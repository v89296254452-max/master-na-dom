import { NextResponse } from "next/server";
import {
  getAccountMergeRows,
  getBrowserAccounts,
  getVkApiAccounts,
} from "@/lib/master-data/accounts";
import { getAccountMergePath } from "@/lib/master-data/account-merge";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      mergePath: getAccountMergePath(),
      rows: getAccountMergeRows(),
      apiAccounts: getVkApiAccounts().map((a) => ({
        id: a.id,
        name: a.name,
        phone: a.phone,
        status: a.status,
        authStatus: a.authStatus,
      })),
      browserAccounts: getBrowserAccounts().map((a) => ({
        id: a.id,
        login: a.login,
        proxy: a.proxy,
        status: a.status,
        authStatus: a.authStatus,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить связку аккаунтов";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
