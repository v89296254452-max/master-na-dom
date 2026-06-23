import { NextResponse } from "next/server";
import { getVkAccountById, readVkAccountsFile } from "@/lib/vk-accounts";
import { runExistingGroupTest, runGroupsCreateTest, runResolveVkUrlTest, runVkApiDiagnostics } from "@/lib/vk-api-diagnostics";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "full";

    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId обязателен" }, { status: 400 });
    }

    const accounts = readVkAccountsFile();
    const account = getVkAccountById(accountId, accounts);

    if (!account) {
      return NextResponse.json({ success: false, error: "Аккаунт не найден" }, { status: 404 });
    }

    if (action === "test-groups-create") {
      const testResult = await runGroupsCreateTest(account);

      return NextResponse.json({
        success: true,
        action,
        testResult,
      });
    }

    if (action === "test-existing-group") {
      const vkGroupId = typeof body.vkGroupId === "string" ? body.vkGroupId.trim() : "";
      const testResult = await runExistingGroupTest(account, vkGroupId);

      return NextResponse.json({
        success: true,
        action,
        testResult,
      });
    }

    if (action === "test-resolve-vk-url") {
      const vkUrl = typeof body.vkUrl === "string" ? body.vkUrl.trim() : "";
      const testResult = await runResolveVkUrlTest(account, vkUrl);

      return NextResponse.json({
        success: true,
        action,
        testResult,
      });
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
