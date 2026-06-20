import { vkApiCallRaw, toVkOwnerId } from "./vk-api-client";
import type { VkAccount } from "./vk-account-types";
import {
  VK_API_DIAGNOSTIC_METHOD_LABELS,
  type VkApiDiagnosticMethod,
  type VkApiDiagnosticStepResult,
  type VkApiDiagnosticsRunResult,
} from "./vk-api-diagnostics-types";

function nowIso(): string {
  return new Date().toISOString();
}

function diagnosticTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toStepResult(
  method: VkApiDiagnosticMethod,
  raw: Awaited<ReturnType<typeof vkApiCallRaw>>,
  note?: string
): VkApiDiagnosticStepResult {
  const vkApiError = raw.body.error;
  const httpError =
    raw.httpStatus >= 400 && !vkApiError
      ? `HTTP ${raw.httpStatus}`
      : null;

  return {
    method,
    label: VK_API_DIAGNOSTIC_METHOD_LABELS[method],
    request: {
      method: raw.method,
      url: raw.url,
      params: raw.requestParams,
    },
    response: raw.body.response ?? null,
    vkError: vkApiError
      ? {
          code: vkApiError.error_code,
          message: vkApiError.error_msg || "VK API error",
        }
      : null,
    httpError,
    durationMs: raw.durationMs,
    success: !vkApiError && !httpError,
    note,
  };
}

function pickAdminGroupId(groupsResponse: unknown): number | null {
  const items = extractGroupsGetItems(groupsResponse);

  for (const item of items) {
    const groupId = extractGroupId(item);
    if (groupId === null) continue;

    if (
      typeof item === "object" &&
      item !== null &&
      ("is_admin" in item || "is_member" in item)
    ) {
      const isAdmin = (item as { is_admin?: number | boolean }).is_admin;
      if (isAdmin === 1 || isAdmin === true) {
        return groupId;
      }
      continue;
    }

    return groupId;
  }

  return null;
}

function extractGroupsGetItems(groupsResponse: unknown): unknown[] {
  if (Array.isArray(groupsResponse)) {
    return groupsResponse;
  }

  if (groupsResponse && typeof groupsResponse === "object" && "items" in groupsResponse) {
    const items = (groupsResponse as { items?: unknown }).items;
    return Array.isArray(items) ? items : [];
  }

  return [];
}

function extractGroupId(item: unknown): number | null {
  if (typeof item === "number" && item > 0) {
    return item;
  }

  if (item && typeof item === "object" && "id" in item) {
    const id = Number((item as { id: unknown }).id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  return null;
}

function parseCreatedGroupId(response: unknown): number | null {
  if (typeof response === "number" && response > 0) {
    return response;
  }

  if (response && typeof response === "object" && "id" in response) {
    const id = Number((response as { id: unknown }).id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  return null;
}

async function runStep(
  accessToken: string,
  method: VkApiDiagnosticMethod,
  params: Record<string, string | number | boolean | undefined>,
  note?: string
): Promise<VkApiDiagnosticStepResult> {
  const raw = await vkApiCallRaw(method, params, accessToken);
  return toStepResult(method, raw, note);
}

export async function runVkApiDiagnostics(account: VkAccount): Promise<VkApiDiagnosticsRunResult> {
  const accessToken = account.accessToken.trim();

  if (!accessToken) {
    throw new Error("У аккаунта не задан accessToken");
  }

  const steps: VkApiDiagnosticStepResult[] = [];
  const stamp = diagnosticTimestamp();
  let testGroupId: number | null = null;
  let createdTestGroup = false;

  const usersStep = await runStep(accessToken, "users.get", {
    fields: "id,first_name,last_name",
  });
  steps.push(usersStep);

  const groupsStep = await runStep(accessToken, "groups.get", {
    filter: "admin",
    extended: 0,
    count: 10,
  });
  steps.push(groupsStep);

  const createNote =
    "Тестовый режим: создаётся группа с префиксом [DIAG-TEST], после проверок удаляется";
  const createStep = await runStep(
    accessToken,
    "groups.create",
    {
      title: `[DIAG-TEST] ${stamp}`,
      description: "VK API diagnostic test group",
      type: "group",
    },
    createNote
  );
  steps.push(createStep);

  if (createStep.success) {
    testGroupId = parseCreatedGroupId(createStep.response);
    createdTestGroup = testGroupId !== null;
  }

  if (!testGroupId && groupsStep.success) {
    testGroupId = pickAdminGroupId(groupsStep.response);
  }

  if (testGroupId) {
    const editStep = await runStep(accessToken, "groups.edit", {
      group_id: testGroupId,
      description: `[DIAG] groups.edit test ${stamp}`,
    });
    steps.push(editStep);

    const wallStep = await runStep(accessToken, "wall.post", {
      owner_id: toVkOwnerId(testGroupId),
      from_group: 1,
      message: `[DIAG] wall.post test ${stamp}`,
    });
    steps.push(wallStep);
  } else {
    steps.push({
      method: "groups.edit",
      label: VK_API_DIAGNOSTIC_METHOD_LABELS["groups.edit"],
      request: {
        method: "groups.edit",
        url: "https://api.vk.com/method/groups.edit",
        params: { v: "5.199", access_token: "***" },
      },
      response: null,
      vkError: {
        message: "Пропущено: нет group_id (groups.create не удался и admin-группы не найдены)",
      },
      httpError: null,
      durationMs: 0,
      success: false,
      note: "Требуется успешный groups.create или admin-группа из groups.get",
    });

    steps.push({
      method: "wall.post",
      label: VK_API_DIAGNOSTIC_METHOD_LABELS["wall.post"],
      request: {
        method: "wall.post",
        url: "https://api.vk.com/method/wall.post",
        params: { v: "5.199", access_token: "***" },
      },
      response: null,
      vkError: {
        message: "Пропущено: нет group_id (groups.create не удался и admin-группы не найдены)",
      },
      httpError: null,
      durationMs: 0,
      success: false,
      note: "Требуется успешный groups.create или admin-группа из groups.get",
    });
  }

  if (createdTestGroup && testGroupId) {
    const cleanup = await vkApiCallRaw(
      "groups.delete",
      { group_id: testGroupId },
      accessToken
    );

    const cleanupError = cleanup.body.error;
    const cleanupNote = cleanupError
      ? `Не удалось удалить тестовую группу ${testGroupId}: ${cleanupError.error_msg || "ошибка VK"}`
      : `Тестовая группа ${testGroupId} удалена после диагностики`;

    const createIndex = steps.findIndex((step) => step.method === "groups.create");
    if (createIndex >= 0) {
      const existingNote = steps[createIndex].note;
      steps[createIndex] = {
        ...steps[createIndex],
        note: existingNote ? `${existingNote}. ${cleanupNote}` : cleanupNote,
      };
    }
  }

  return {
    accountId: account.id,
    accountName: account.name,
    ranAt: nowIso(),
    steps,
  };
}

export function isVkApiDiagnosticMethod(value: unknown): value is VkApiDiagnosticMethod {
  return (
    typeof value === "string" &&
    (Object.keys(VK_API_DIAGNOSTIC_METHOD_LABELS) as VkApiDiagnosticMethod[]).includes(
      value as VkApiDiagnosticMethod
    )
  );
}
