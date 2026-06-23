import { sanitizeVkScreenName as sanitizeVkScreenNameFromLib } from "./vk-screen-name";

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
  rawBody: {
    response?: unknown;
    error?: {
      error_code?: number;
      error_msg?: string;
    };
  };
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

export interface VkResolveScreenNameResult {
  type: string;
  objectId: number;
  raw: {
    type?: string;
    object_id?: number;
    group_id?: number;
  };
}

const RESOLVABLE_SCREEN_NAME_TYPES = new Set(["group", "page", "event"]);

export async function resolveScreenName(
  accessToken: string,
  screenName: string
): Promise<VkResolveScreenNameResult | null> {
  const response = await vkApiRequest<{
    type?: string;
    object_id?: number;
    group_id?: number;
  }>("utils.resolveScreenName", { screen_name: screenName.replace(/^@+/, "") }, accessToken);

  const type = typeof response.type === "string" ? response.type : "";
  const objectId =
    typeof response.object_id === "number" && response.object_id > 0
      ? Math.floor(response.object_id)
      : typeof response.group_id === "number" && response.group_id > 0
        ? Math.floor(response.group_id)
        : null;

  if (!type || objectId === null || !RESOLVABLE_SCREEN_NAME_TYPES.has(type)) {
    return null;
  }

  return {
    type,
    objectId,
    raw: response,
  };
}

export function toVkOwnerId(groupId: number): number {
  return -Math.abs(groupId);
}

export function logVkApiRequest(method: string, params: Record<string, unknown>): void {
  console.log(`[VK API] REQUEST method=${method} params=${JSON.stringify(params)}`);
}

export function logVkApiResponse(method: string, body: unknown): void {
  console.log(`[VK API] RESPONSE method=${method} body=${JSON.stringify(body)}`);
}

export function extractGroupIdFromCreateResponse(response: unknown): number | null {
  if (typeof response === "number" && response > 0) {
    return Math.floor(response);
  }

  if (typeof response === "string" && response.trim()) {
    return normalizeVkGroupId(response);
  }

  if (!response || typeof response !== "object") {
    return null;
  }

  const record = response as Record<string, unknown>;

  for (const key of ["id", "group_id", "groupId"]) {
    const value = record[key];
    if (typeof value === "number" && value > 0) {
      return Math.floor(value);
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = normalizeVkGroupId(value);
      if (parsed) return parsed;
    }
  }

  return null;
}

export async function createGroup(
  accessToken: string,
  title: string,
  description: string
): Promise<VkCreateGroupResult> {
  const method = "groups.create";
  const params = {
    title,
    description,
    type: "group",
  };

  logVkApiRequest(method, params);

  const raw = await vkApiCallRaw(method, params, accessToken);

  logVkApiResponse(method, raw.body);

  if (raw.body.error) {
    throw new VkApiError(
      raw.body.error.error_msg || "VK API error",
      raw.body.error.error_code
    );
  }

  const groupId = extractGroupIdFromCreateResponse(raw.body.response);

  if (!groupId) {
    throw new VkApiError(
      `groups.create did not return group id. Full VK response: ${JSON.stringify(raw.body)}`
    );
  }

  return {
    groupId,
    vkUrl: buildVkClubUrl(groupId),
    rawBody: raw.body,
  };
}

export async function editGroup(
  accessToken: string,
  groupId: number,
  params: { description?: string; title?: string; website?: string }
): Promise<1> {
  return vkApiRequest<1>("groups.edit", {
    group_id: groupId,
    description: params.description,
    title: params.title,
    website: params.website,
  }, accessToken);
}

/**
 * Короткий адрес сообщества (screen_name).
 * VK задаёт его через groups.edit (параметр screen_name).
 */
export async function editGroupAddress(
  accessToken: string,
  groupId: number,
  screenName: string
): Promise<1> {
  return vkApiRequest<1>("groups.edit", {
    group_id: groupId,
    screen_name: screenName,
  }, accessToken);
}

export function sanitizeVkScreenName(slug: string): string {
  return sanitizeVkScreenNameFromLib(slug);
}

export interface VkPublishPostResult {
  postId: number;
  ownerId: number;
}

export interface VkWallUploadServer {
  upload_url: string;
  album_id?: number;
  group_id?: number;
}

export interface VkPhotoUploadServerResponse {
  server: number | string;
  photo: string;
  hash: string;
}

export interface VkSavedWallPhoto {
  id: number;
  owner_id: number;
  album_id?: number;
}

export async function getWallUploadServer(
  accessToken: string,
  groupId: number
): Promise<VkWallUploadServer> {
  const response = await vkApiRequest<VkWallUploadServer>(
    "photos.getWallUploadServer",
    { group_id: groupId },
    accessToken
  );

  if (!response.upload_url) {
    throw new VkApiError("photos.getWallUploadServer did not return upload_url");
  }

  return response;
}

export async function uploadPhotoToServer(
  uploadUrl: string,
  photoBuffer: Buffer,
  filename = "photo.jpg"
): Promise<VkPhotoUploadServerResponse> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(photoBuffer)]);
  formData.append("photo", blob, filename);

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new VkApiError(`Photo upload HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  let data: VkPhotoUploadServerResponse;

  try {
    data = JSON.parse(text) as VkPhotoUploadServerResponse;
  } catch {
    throw new VkApiError(`Photo upload returned invalid JSON: ${text.slice(0, 200)}`);
  }

  if (data.server === undefined || !data.photo || !data.hash) {
    throw new VkApiError(`Photo upload missing fields: ${text.slice(0, 200)}`);
  }

  return data;
}

export async function saveWallPhoto(
  accessToken: string,
  groupId: number,
  uploadResult: VkPhotoUploadServerResponse
): Promise<VkSavedWallPhoto[]> {
  return vkApiRequest<VkSavedWallPhoto[]>("photos.saveWallPhoto", {
    group_id: groupId,
    server: uploadResult.server,
    photo: uploadResult.photo,
    hash: uploadResult.hash,
  }, accessToken);
}

export interface VkOwnerPhotoUploadServer {
  upload_url: string;
}

export interface VkSavedOwnerPhoto {
  id?: number;
  photo_id?: number;
  owner_id?: number;
  album_id?: number;
}

export async function getOwnerPhotoUploadServer(
  accessToken: string,
  ownerId: number
): Promise<VkOwnerPhotoUploadServer> {
  const response = await vkApiRequest<VkOwnerPhotoUploadServer>(
    "photos.getOwnerPhotoUploadServer",
    { owner_id: ownerId },
    accessToken
  );

  if (!response.upload_url) {
    throw new VkApiError("photos.getOwnerPhotoUploadServer did not return upload_url");
  }

  return response;
}

export async function uploadOwnerPhotoToServer(
  uploadUrl: string,
  photoBuffer: Buffer,
  filename = "photo.jpg"
): Promise<VkPhotoUploadServerResponse> {
  return uploadPhotoToServer(uploadUrl, photoBuffer, filename);
}

export async function saveOwnerPhoto(
  accessToken: string,
  uploadResult: VkPhotoUploadServerResponse
): Promise<VkSavedOwnerPhoto> {
  return vkApiRequest<VkSavedOwnerPhoto>("photos.saveOwnerPhoto", {
    server: uploadResult.server,
    photo: uploadResult.photo,
    hash: uploadResult.hash,
  }, accessToken);
}

export function buildAttachmentString(ownerId: number, photoId: number): string {
  return `photo${ownerId}_${photoId}`;
}

export function buildGroupDisplayUrl(groupId: number | string, screenName?: string): string {
  const screen = screenName?.trim().replace(/^@+/, "");
  if (screen) {
    return `https://vk.com/${screen}`;
  }
  return buildVkClubUrl(groupId);
}

export interface VkGroupInfo {
  id: number;
  name: string;
  screenName: string;
  isAdmin: boolean;
  canPost: boolean;
  canEdit: boolean;
  displayUrl: string;
  raw: Record<string, unknown>;
}

function extractGroupsGetByIdItems(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) {
    return response.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }

  if (response && typeof response === "object" && "groups" in response) {
    const groups = (response as { groups?: unknown }).groups;
    if (Array.isArray(groups)) {
      return groups.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }
  }

  return [];
}

export async function getGroupById(accessToken: string, groupId: number): Promise<VkGroupInfo | null> {
  const response = await vkApiRequest<unknown>(
    "groups.getById",
    {
      group_id: groupId,
      fields: "screen_name,is_admin,can_post,is_closed,type",
    },
    accessToken
  );

  const item = extractGroupsGetByIdItems(response)[0];
  if (!item) return null;

  const id = typeof item.id === "number" ? item.id : Number(item.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const name = typeof item.name === "string" ? item.name : "";
  const screenName = typeof item.screen_name === "string" ? item.screen_name : "";
  const isAdmin = item.is_admin === 1 || item.is_admin === true;
  const canPost = item.can_post === 1 || item.can_post === true || isAdmin;
  const canEdit = isAdmin;

  return {
    id,
    name,
    screenName,
    isAdmin,
    canPost,
    canEdit,
    displayUrl: buildGroupDisplayUrl(id, screenName),
    raw: item,
  };
}

export async function publishPost(
  accessToken: string,
  ownerId: number,
  message: string,
  attachments?: string
): Promise<VkPublishPostResult> {
  const postId = await vkApiRequest<number>("wall.post", {
    owner_id: ownerId,
    from_group: 1,
    message,
    attachments: attachments?.trim() || undefined,
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
