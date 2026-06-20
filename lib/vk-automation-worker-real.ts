import type { VkAccount } from "./vk-account-types";
import { isAccountEligibleForAssignment } from "./vk-account-auth";
import { getVkAccountById, readVkAccountsFile } from "./vk-accounts";
import type { VkAutomationAction } from "./vk-automation-queue-types";
import type { WorkerJob } from "./vk-automation-worker-mock";
import { readVkAutomationQueueFile } from "./vk-automation-queue";
import {
  buildVkClubUrl,
  checkToken,
  createGroup,
  editGroup,
  normalizeVkGroupId,
  pinWallPost,
  publishPost,
  toVkOwnerId,
  VkApiError,
} from "./vk-api-client";
import type { VkTask } from "./vk-task-types";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "./vk-tasks";

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

function persistTaskGroupInfo(taskId: string, vkGroupId: string, vkUrl: string): void {
  const tasks = readVkTasksFile();
  const updated = updateVkTask(tasks, taskId, { vkGroupId, vkUrl });
  if (!updated) {
    throw new VkWorkerExecutionError(`Failed to update task ${taskId} with group info`);
  }
  writeVkTasksFile(tasks);
}

function pickPinnedMessage(task: VkTask): string {
  const pinned = task.contentPack.pinnedPost.trim();
  if (pinned) return pinned;
  return task.vkFirstPost.trim() || task.vkDescription.trim();
}

async function executeLoginAccount(job: WorkerJob, accessToken: string): Promise<Record<string, unknown>> {
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

async function executeCreateGroup(job: WorkerJob, accessToken: string, task: VkTask): Promise<Record<string, unknown>> {
  const title = task.vkName.trim() || `${task.service} ${task.city}`.trim();
  const description = task.vkDescription.trim() || task.contentPack.pinnedPost.trim();

  if (!title) {
    throw new VkWorkerExecutionError("Task vkName/title is empty");
  }

  const created = await createGroup(accessToken, title, description);
  const vkGroupId = String(created.groupId);
  const vkUrl = created.vkUrl;

  persistTaskGroupInfo(task.id, vkGroupId, vkUrl);

  return {
    mock: false,
    vkGroupId,
    vkUrl,
    message: "VK group created via API",
  };
}

async function executeFillDescription(
  job: WorkerJob,
  accessToken: string,
  task: VkTask
): Promise<Record<string, unknown>> {
  const groupId = resolveGroupIdForTask(task);
  const description = task.vkDescription.trim() || task.contentPack.pinnedPost.trim();

  if (!description) {
    throw new VkWorkerExecutionError("Task description is empty");
  }

  await editGroup(accessToken, groupId, { description });

  return {
    mock: false,
    vkGroupId: String(groupId),
    message: "Group description updated via VK API",
  };
}

async function executePublishPinnedPost(
  job: WorkerJob,
  accessToken: string,
  task: VkTask
): Promise<Record<string, unknown>> {
  const groupId = resolveGroupIdForTask(task);
  const ownerId = toVkOwnerId(groupId);
  const message = pickPinnedMessage(task);

  if (!message) {
    throw new VkWorkerExecutionError("Pinned post content is empty");
  }

  const published = await publishPost(accessToken, ownerId, message);
  await pinWallPost(accessToken, ownerId, published.postId);

  return {
    mock: false,
    vkGroupId: String(groupId),
    postId: published.postId,
    message: "Pinned post published via VK API",
  };
}

async function executeSaveResult(job: WorkerJob, task: VkTask): Promise<Record<string, unknown>> {
  const groupId = resolveGroupIdForTask(task);
  const vkGroupId = String(groupId);
  const vkUrl = task.vkUrl.trim() || buildVkClubUrl(groupId);

  return {
    mock: false,
    vkUrl,
    vkGroupId,
    taskStatus: "posted",
    message: "Task result prepared for save",
  };
}

async function executeStubAction(action: VkAutomationAction): Promise<Record<string, unknown>> {
  return {
    mock: false,
    skipped: true,
    message: `Action "${action}" is not implemented in real worker yet`,
  };
}

export async function executeRealJob(job: WorkerJob): Promise<Record<string, unknown>> {
  const task = getTaskById(job.taskId);
  const account = getAccountById(job.accountId);
  const accessToken = requireConnectedAccount(account);

  switch (job.action) {
    case "login_account":
      return executeLoginAccount(job, accessToken);
    case "create_group":
      return executeCreateGroup(job, accessToken, task);
    case "fill_description":
      return executeFillDescription(job, accessToken, task);
    case "publish_pinned_post":
      return executePublishPinnedPost(job, accessToken, task);
    case "save_result":
      return executeSaveResult(job, task);
    case "upload_avatar":
    case "upload_cover":
    case "publish_post":
      return executeStubAction(job.action);
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
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown VK worker error";
}
