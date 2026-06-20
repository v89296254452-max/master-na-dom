export const VK_API_VERSION = "5.199";

const VK_API_BASE = "https://api.vk.com/method";

export class VkApiError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "VkApiError";
    this.code = code;
  }
}

interface VkApiResponse<T> {
  response?: T;
  error?: {
    error_code?: number;
    error_msg?: string;
  };
}

export interface VkApiRawCallResult {
  method: string;
  url: string;
  requestParams: Record<string, string>;
  httpStatus: number;
  durationMs: number;
  body: VkApiResponse<unknown>;
}

export async function vkApiCallRaw(
  method: string,
  params: Record<string, string | number | boolean | undefined>,
  accessToken: string
): Promise<VkApiRawCallResult> {
  const requestParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    requestParams[key] = String(value);
  }

  requestParams.v = VK_API_VERSION;

  const body = new URLSearchParams(requestParams);
  body.set("access_token", accessToken);

  const url = `${VK_API_BASE}/${method}`;
  const startedAt = Date.now();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const durationMs = Date.now() - startedAt;
  const displayParams = { ...requestParams, access_token: "***" };

  if (!response.ok) {
    return {
      method,
      url,
      requestParams: displayParams,
      httpStatus: response.status,
      durationMs,
      body: {
        error: {
          error_msg: `VK HTTP ${response.status}: ${response.statusText}`,
        },
      },
    };
  }

  const data = (await response.json()) as VkApiResponse<unknown>;

  return {
    method,
    url,
    requestParams: displayParams,
    httpStatus: response.status,
    durationMs,
    body: data,
  };
}

export async function deleteGroup(accessToken: string, groupId: number): Promise<1> {
  return vkApiRequest<1>("groups.delete", { group_id: groupId }, accessToken);
}

export async function vkApiRequest<T = unknown>(
  method: string,
  params: Record<string, string | number | boolean | undefined>,
  accessToken: string
): Promise<T> {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    body.set(key, String(value));
  }

  body.set("access_token", accessToken);
  body.set("v", VK_API_VERSION);

  const response = await fetch(`${VK_API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new VkApiError(`VK HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as VkApiResponse<T>;

  if (data.error) {
    throw new VkApiError(data.error.error_msg || "VK API error", data.error.error_code);
  }

  if (data.response === undefined) {
    throw new VkApiError("VK API returned empty response");
  }

  return data.response;
}

export interface VkTokenCheckResult {
  valid: boolean;
  userId?: number;
  firstName?: string;
  lastName?: string;
}

export async function checkToken(accessToken: string): Promise<VkTokenCheckResult> {
  const response = await vkApiRequest<
    Array<{ id: number; first_name?: string; last_name?: string }>
  >("users.get", {}, accessToken);

  const user = response[0];
  if (!user?.id) {
    return { valid: false };
  }

  return {
    valid: true,
    userId: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
  };
}

export interface VkCreateGroupResult {
  groupId: number;
  vkUrl: string;
}

export function buildVkClubUrl(groupId: number | string): string {
  const id = String(groupId).replace(/^-/, "");
  return `https://vk.com/club${id}`;
}

export function normalizeVkGroupId(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;

  const raw = String(value).trim().replace(/^mock_/, "");
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
}

export function toVkOwnerId(groupId: number): number {
  return -Math.abs(groupId);
}

export async function createGroup(
  accessToken: string,
  title: string,
  description: string
): Promise<VkCreateGroupResult> {
  const groupId = await vkApiRequest<number>("groups.create", {
    title,
    description,
    type: "group",
  }, accessToken);

  if (!groupId) {
    throw new VkApiError("groups.create did not return group_id");
  }

  return {
    groupId,
    vkUrl: buildVkClubUrl(groupId),
  };
}

export async function editGroup(
  accessToken: string,
  groupId: number,
  params: { description?: string; title?: string }
): Promise<1> {
  return vkApiRequest<1>("groups.edit", {
    group_id: groupId,
    description: params.description,
    title: params.title,
  }, accessToken);
}

export interface VkPublishPostResult {
  postId: number;
  ownerId: number;
}

export async function publishPost(
  accessToken: string,
  ownerId: number,
  message: string
): Promise<VkPublishPostResult> {
  const postId = await vkApiRequest<number>("wall.post", {
    owner_id: ownerId,
    from_group: 1,
    message,
  }, accessToken);

  return { postId, ownerId };
}

export async function pinWallPost(
  accessToken: string,
  ownerId: number,
  postId: number
): Promise<1> {
  return vkApiRequest<1>("wall.pin", {
    owner_id: ownerId,
    post_id: postId,
  }, accessToken);
}
