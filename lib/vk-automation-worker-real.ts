import type { VkAccount } from "./vk-account-types";
import { isAccountEligibleForAssignment } from "./vk-account-auth";
import { getVkAccountById, readVkAccountsFile } from "./vk-accounts";
import type { VkAutomationAction } from "./vk-automation-queue-types";
import { readVkAutomationQueueFile } from "./vk-automation-queue";
import { findTaskPipelineJob } from "./vk-automation-pipeline";
import {
  VkWorkerNotReadyError,
  VkWorkerSkipError,
  assertTaskReadyForWorkerAction,
  type WorkerJob,
} from "./vk-automation-worker-types";
import {
  buildAttachmentString,
  buildVkClubUrl,
  checkToken,
  getOwnerPhotoUploadServer,
  getWallUploadServer,
  normalizeVkGroupId,
  pinWallPost,
  publishPost,
  saveOwnerPhoto,
  saveWallPhoto,
  toVkOwnerId,
  uploadOwnerPhotoToServer,
  uploadPhotoToServer,
  VkApiError,
} from "./vk-api-client";
import { normalizeImageAssets } from "./vk-image-assets-types";
import {
  autoAssignAvatarIfEmpty,
  autoAssignPostImageIfEmpty,
} from "./vk-image-assets-server";
import type { VkTask } from "./vk-task-types";
import { readVkTasksFile } from "./vk-tasks";
import fs from "fs";
import path from "path";

export const REAL_MODE_DISABLED_MESSAGE = "Disabled in real mode";

/** Устаревшие шаги — пропускаются в real mode (Posts Only). */
const REAL_MODE_DEPRECATED_ACTIONS = new Set<VkAutomationAction>([
  "setup_group",
  "fill_description",
  "upload_cover",
]);

/** Временно отключено в real worker. */
const REAL_MODE_DISABLED_ACTIONS = new Set<VkAutomationAction>([]);

export class VkWorkerExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VkWorkerExecutionError";
  }
}

function getTaskById(taskId: string): VkTask {
  const tasks = readVkTasksFile();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new VkWorkerExecutionError(`Task not found: ${taskId}`);
  }
  return task;
}

function getAccountById(accountId: string): VkAccount {
  const account = getVkAccountById(accountId, readVkAccountsFile());
  if (!account) {
    throw new VkWorkerExecutionError(`Account not found: ${accountId}`);
  }
  return account;
}

function requireConnectedAccount(account: VkAccount): string {
  if (!isAccountEligibleForAssignment(account)) {
    throw new VkWorkerExecutionError(
      `Account ${account.id} is not eligible (status=${account.status}, authStatus=${account.authStatus})`
    );
  }

  const token = account.accessToken.trim();
  if (!token) {
    throw new VkWorkerExecutionError(`Account ${account.id} has empty accessToken`);
  }

  return token;
}

function findCreateGroupResult(taskId: string): { vkGroupId: string; vkUrl: string } | null {
  const jobs = readVkAutomationQueueFile();
  const createJob = jobs.find(
    (job) =>
      job.taskId === taskId &&
      job.action === "create_group" &&
      job.status === "success" &&
      typeof job.result.vkGroupId !== "undefined"
  );

  if (!createJob) return null;

  const vkGroupId = String(createJob.result.vkGroupId ?? "").trim();
  const vkUrl = String(createJob.result.vkUrl ?? "").trim();

  if (!vkGroupId) return null;
  return { vkGroupId, vkUrl: vkUrl || buildVkClubUrl(vkGroupId) };
}

export function resolveGroupIdForTask(task: VkTask): number {
  const fromTask = normalizeVkGroupId(task.vkGroupId);
  if (fromTask) return fromTask;

  const fromQueue = findCreateGroupResult(task.id);
  const fromQueueId = normalizeVkGroupId(fromQueue?.vkGroupId);
  if (fromQueueId) return fromQueueId;

  throw new VkWorkerExecutionError(`vkGroupId is missing for task ${task.id}`);
}

/** Закреплённый / главный пост — один на задачу. */
function pickPinnedMessage(task: VkTask): string {
  const pinned = task.contentPack.pinnedPost.trim();
  if (pinned) return pinned;

  const first = task.vkFirstPost.trim();
  if (first) return first;

  return task.vkDescription.trim();
}

/** Дополнительный пост — только post2, не дублирует закреплённый. */
function pickAdditionalPostMessage(task: VkTask, pinnedMessage: string): string {
  const post2 = task.contentPack.post2.trim();
  if (!post2) {
    throw new VkWorkerExecutionError("Additional post (contentPack.post2) is empty");
  }

  if (post2 === pinnedMessage) {
    throw new VkWorkerExecutionError("post2 must differ from pinned post content");
  }

  return post2;
}

function isPipelineStepSuccessful(taskId: string, action: "publish_post" | "publish_pinned_post"): boolean {
  const job = findTaskPipelineJob(readVkAutomationQueueFile(), taskId, action);
  return job?.status === "success";
}

function throwRealModeDisabled(action: VkAutomationAction): never {
  throw new VkWorkerSkipError(REAL_MODE_DISABLED_MESSAGE, {
    mock: false,
    skipped: true,
    action,
    message: REAL_MODE_DISABLED_MESSAGE,
  });
}

interface PostImageAttachmentResult {
  imagePath?: string;
  uploadSuccess: boolean;
  attachmentId?: string;
  warning?: string;
}

function resolvePublicAssetPath(publicPath: string): string | null {
  const trimmed = publicPath.trim();
  if (!trimmed) return null;

  const relative = trimmed.replace(/^\/+/, "");
  const absolute = path.join(process.cwd(), "public", relative);

  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return null;
  }

  return absolute;
}

async function attachPostImageIfAvailable(
  accessToken: string,
  groupId: number,
  imagePublicPath: string | undefined,
  logPrefix: string
): Promise<PostImageAttachmentResult> {
  const imagePath = imagePublicPath?.trim();

  if (!imagePath) {
    console.log(`[VK Worker] ${logPrefix} image path=none (text-only post)`);
    return { uploadSuccess: false };
  }

  console.log(`[VK Worker] ${logPrefix} image path=${imagePath}`);

  const absolutePath = resolvePublicAssetPath(imagePath);
  if (!absolutePath) {
    const warning = `Image file not found: ${imagePath}`;
    console.warn(`[VK Worker] ${logPrefix} upload success=false warning=${warning}`);
    return { imagePath, uploadSuccess: false, warning };
  }

  try {
    const buffer = fs.readFileSync(absolutePath);
    const filename = path.basename(absolutePath) || "photo.jpg";
    const uploadServer = await getWallUploadServer(accessToken, groupId);
    const uploadResult = await uploadPhotoToServer(uploadServer.upload_url, buffer, filename);
    const savedPhotos = await saveWallPhoto(accessToken, groupId, uploadResult);
    const photo = savedPhotos[0];

    if (!photo?.id || photo.owner_id === undefined) {
      const warning = "photos.saveWallPhoto returned empty photo";
      console.warn(`[VK Worker] ${logPrefix} upload success=false warning=${warning}`);
      return { imagePath, uploadSuccess: false, warning };
    }

    const attachmentId = buildAttachmentString(photo.owner_id, photo.id);
    console.log(
      `[VK Worker] ${logPrefix} upload success=true attachment id=${attachmentId}`
    );

    return {
      imagePath,
      uploadSuccess: true,
      attachmentId,
    };
  } catch (error) {
    const warning = formatVkError(error);
    console.warn(`[VK Worker] ${logPrefix} upload success=false warning=${warning}`);
    return { imagePath, uploadSuccess: false, warning };
  }
}

function buildPublishResult(
  base: Record<string, unknown>,
  imageResult: PostImageAttachmentResult,
  withPhotoMessage: string,
  photoSkippedMessage: string,
  textOnlyMessage: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...base,
    imagePath: imageResult.imagePath ?? "",
    uploadSuccess: imageResult.uploadSuccess,
    attachmentId: imageResult.attachmentId ?? "",
  };

  if (imageResult.warning) {
    result.warning = imageResult.warning;
  }

  if (imageResult.uploadSuccess && imageResult.attachmentId) {
    result.message = withPhotoMessage;
  } else if (imageResult.warning) {
    result.message = photoSkippedMessage;
  } else {
    result.message = textOnlyMessage;
  }

  return result;
}

async function executeLoginAccount(_job: WorkerJob, accessToken: string): Promise<Record<string, unknown>> {
  const check = await checkToken(accessToken);
  if (!check.valid) {
    throw new VkWorkerExecutionError("VK token check failed");
  }

  return {
    mock: false,
    valid: true,
    userId: check.userId,
    message: "VK token is valid",
  };
}

async function executeCreateGroup(_job: WorkerJob, _accessToken: string, task: VkTask): Promise<Record<string, unknown>> {
  const groupId = normalizeVkGroupId(task.vkGroupId);

  if (groupId) {
    const vkGroupId = String(groupId);
    const vkUrl = task.vkUrl.trim() || buildVkClubUrl(groupId);

    return {
      mock: false,
      vkGroupId,
      groupId,
      id: groupId,
      vkUrl,
      message: "Group already exists, skipped create_group",
    };
  }

  throw new VkWorkerSkipError("vkGroupId is missing, manual creation required", {
    mock: false,
    skipped: true,
    message: "vkGroupId is missing, manual creation required",
  });
}

async function executeNeedManualCreate(_job: WorkerJob): Promise<Record<string, unknown>> {
  throw new VkWorkerSkipError("Нужно вручную создать группу и указать vkGroupId", {
    mock: false,
    skipped: true,
    message: "Нужно вручную создать группу и указать vkGroupId",
  });
}

async function executeNeedManualCheck(_job: WorkerJob): Promise<Record<string, unknown>> {
  throw new VkWorkerSkipError("vkGroupId не заполнен", {
    mock: false,
    skipped: true,
    message: "vkGroupId не заполнен",
  });
}

async function executeUploadAvatar(
  job: WorkerJob,
  accessToken: string,
  task: VkTask
): Promise<Record<string, unknown>> {
  assertTaskReadyForWorkerAction(task, job.action);
  const currentTask = autoAssignAvatarIfEmpty(task.id);
  const groupId = resolveGroupIdForTask(currentTask);
  const vkGroupId = String(groupId);
  const imageAssets = normalizeImageAssets(currentTask.imageAssets);
  const avatarPath = imageAssets.avatarPath.trim();
  const logPrefix = `upload_avatar taskId=${task.id} vkGroupId=${vkGroupId} avatarPath=${avatarPath || "(empty)"}`;

  if (!avatarPath) {
    console.log(`[VK Worker] ${logPrefix} result=skipped message=avatarPath empty`);
    throw new VkWorkerSkipError("avatarPath empty", {
      mock: false,
      skipped: true,
      taskId: task.id,
      vkGroupId,
      avatarPath: "",
      message: "avatarPath empty",
    });
  }

  const absolutePath = resolvePublicAssetPath(avatarPath);
  if (!absolutePath) {
    console.log(`[VK Worker] ${logPrefix} result=skipped message=avatarPath empty`);
    throw new VkWorkerSkipError("avatarPath empty", {
      mock: false,
      skipped: true,
      taskId: task.id,
      vkGroupId,
      avatarPath,
      message: "avatarPath empty",
    });
  }

  try {
    const buffer = fs.readFileSync(absolutePath);
    const filename = path.basename(absolutePath) || "avatar.jpg";
    const ownerId = toVkOwnerId(groupId);
    const uploadServer = await getOwnerPhotoUploadServer(accessToken, ownerId);
    const uploadResult = await uploadOwnerPhotoToServer(uploadServer.upload_url, buffer, filename);
    await saveOwnerPhoto(accessToken, uploadResult);

    console.log(`[VK Worker] ${logPrefix} result=success`);

    return {
      mock: false,
      taskId: task.id,
      vkGroupId,
      avatarPath,
      avatarUploaded: true,
      message: "Avatar uploaded via VK API",
    };
  } catch (error) {
    const errorText = formatVkError(error);
    console.error(`[VK Worker] ${logPrefix} result=error error=${errorText}`);
    throw error;
  }
}

async function executePublishPinnedPost(
  job: WorkerJob,
  accessToken: string,
  task: VkTask
): Promise<Record<string, unknown>> {
  assertTaskReadyForWorkerAction(task, job.action);
  const currentTask = autoAssignPostImageIfEmpty(task.id, 0);
  const groupId = resolveGroupIdForTask(currentTask);
  const ownerId = toVkOwnerId(groupId);
  const message = pickPinnedMessage(currentTask);

  if (!message) {
    throw new VkWorkerExecutionError("Pinned post content is empty");
  }

  const imageAssets = normalizeImageAssets(currentTask.imageAssets);
  const imageResult = await attachPostImageIfAvailable(
    accessToken,
    groupId,
    imageAssets.postImagePaths[0],
    `publish_pinned_post task=${currentTask.id}`
  );

  const published = await publishPost(
    accessToken,
    ownerId,
    message,
    imageResult.attachmentId
  );
  await pinWallPost(accessToken, ownerId, published.postId);

  return buildPublishResult(
    {
      mock: false,
      vkGroupId: String(groupId),
      postId: published.postId,
    },
    imageResult,
    "Pinned post published via VK API with photo",
    "Pinned post published via VK API (text only, photo skipped)",
    "Pinned post published via VK API"
  );
}

async function executePublishPost(
  job: WorkerJob,
  accessToken: string,
  task: VkTask
): Promise<Record<string, unknown>> {
  assertTaskReadyForWorkerAction(task, job.action);
  const currentTask = autoAssignPostImageIfEmpty(task.id, 1);
  const groupId = resolveGroupIdForTask(currentTask);
  const ownerId = toVkOwnerId(groupId);
  const pinnedMessage = pickPinnedMessage(currentTask);
  const message = pickAdditionalPostMessage(currentTask, pinnedMessage);

  const imageAssets = normalizeImageAssets(currentTask.imageAssets);
  const imageResult = await attachPostImageIfAvailable(
    accessToken,
    groupId,
    imageAssets.postImagePaths[1],
    `publish_post task=${currentTask.id}`
  );

  const published = await publishPost(
    accessToken,
    ownerId,
    message,
    imageResult.attachmentId
  );

  return buildPublishResult(
    {
      mock: false,
      vkGroupId: String(groupId),
      postId: published.postId,
    },
    imageResult,
    "Additional post published via VK API with photo",
    "Additional post published via VK API (text only, photo skipped)",
    "Additional post published via VK API"
  );
}

async function executeSaveResult(job: WorkerJob, task: VkTask): Promise<Record<string, unknown>> {
  assertTaskReadyForWorkerAction(task, job.action);
  const groupId = resolveGroupIdForTask(task);
  const vkGroupId = String(groupId);
  const vkUrl = task.vkUrl.trim() || buildVkClubUrl(groupId);

  const publishPostOk = isPipelineStepSuccessful(job.taskId, "publish_post");
  const taskStatus = publishPostOk ? "posted" : "filled";

  return {
    mock: false,
    vkUrl,
    vkGroupId,
    taskStatus,
    publishPostSuccess: publishPostOk,
    message: publishPostOk
      ? "Task marked as posted after successful publish_post"
      : "Task saved without posted status (publish_post not success)",
  };
}

export async function executeRealJob(job: WorkerJob): Promise<Record<string, unknown>> {
  const task = getTaskById(job.taskId);
  if (task.status !== "ready_for_worker") {
    throw new VkWorkerSkipError(`Задача ${task.id} не в статусе ready_for_worker`, {});
  }

  if (REAL_MODE_DEPRECATED_ACTIONS.has(job.action)) {
    throwRealModeDisabled(job.action);
  }

  if (REAL_MODE_DISABLED_ACTIONS.has(job.action)) {
    throwRealModeDisabled(job.action);
  }

  const account = getAccountById(job.accountId);
  const accessToken = requireConnectedAccount(account);

  switch (job.action) {
    case "login_account":
      return executeLoginAccount(job, accessToken);
    case "create_group":
      return executeCreateGroup(job, accessToken, task);
    case "need_manual_create":
      return executeNeedManualCreate(job);
    case "need_manual_check":
      return executeNeedManualCheck(job);
    case "upload_avatar":
      return executeUploadAvatar(job, accessToken, task);
    case "publish_pinned_post":
      return executePublishPinnedPost(job, accessToken, task);
    case "publish_post":
      return executePublishPost(job, accessToken, task);
    case "save_result":
      return executeSaveResult(job, task);
    default:
      throw new VkWorkerExecutionError(`Unsupported action: ${job.action}`);
  }
}

export function formatVkError(error: unknown): string {
  if (error instanceof VkApiError) {
    return error.code ? `VK API [${error.code}]: ${error.message}` : `VK API: ${error.message}`;
  }
  if (error instanceof VkWorkerExecutionError) {
    return error.message;
  }
  if (error instanceof VkWorkerNotReadyError) {
    return error.message;
  }
  if (error instanceof VkWorkerSkipError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown VK worker error";
}

export type { WorkerJob } from "./vk-automation-worker-types";
export {
  VkWorkerSkipError,
  VkWorkerNotReadyError,
  isWorkerNotReadyError,
  isWorkerSkipError,
} from "./vk-automation-worker-types";
