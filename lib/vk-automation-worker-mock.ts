import { VkWorkerSkipError, assertTaskReadyForWorkerAction, type WorkerJob } from "./vk-automation-worker-types";
import { readVkTasksFile } from "./vk-tasks";
import { normalizeVkGroupId, buildVkClubUrl } from "./vk-api-client";

export type { WorkerJob } from "./vk-automation-worker-types";

function sleep(ms: number): Promise<void> {  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomMockDelayMs(): number {
  return 1000 + Math.floor(Math.random() * 1000);
}

export function buildMockResult(job: WorkerJob): Record<string, unknown> {
  const base = {
    mock: true,
    message: "Action completed in mock mode",
  };

  if (job.action === "need_manual_check") {
    return {
      ...base,
      skipped: true,
      message: "Не удалось распознать vkGroupId из vkUrl",
    };
  }

  if (job.action === "need_manual_create") {
    return {
      ...base,
      skipped: true,
      message: "Нужно вручную создать группу и указать vkGroupId",
    };
  }

  if (job.action === "create_group") {
    const tasks = readVkTasksFile();
    const task = tasks.find((item) => item.id === job.taskId);
    const groupId = task ? normalizeVkGroupId(task.vkGroupId) : null;

    if (groupId) {
      return {
        ...base,
        vkUrl: task?.vkUrl.trim() || buildVkClubUrl(groupId),
        vkGroupId: String(groupId),
        groupId,
        id: groupId,
        message: "Group already exists, skipped create_group",
      };
    }

    return {
      ...base,
      skipped: true,
      message: "vkGroupId is missing, manual creation required",
    };
  }

  if (job.action === "save_result") {
    const tasks = readVkTasksFile();
    const task = tasks.find((item) => item.id === job.taskId);
    const payload = job.payload ?? {};
    const groupId = task ? normalizeVkGroupId(task.vkGroupId) : null;
    const vkGroupId =
      groupId !== null
        ? String(groupId)
        : typeof payload.vkGroupId === "string" && payload.vkGroupId.trim()
          ? payload.vkGroupId.trim()
          : `mock_${job.taskId}`;
    const vkUrl =
      task?.vkUrl.trim() ||
      (typeof payload.vkUrl === "string" && payload.vkUrl.trim() ? payload.vkUrl.trim() : "") ||
      (groupId !== null ? buildVkClubUrl(groupId) : `https://vk.com/club_mock_${job.taskId}`);
    const taskStatus =
      payload.taskStatus === "posted" || payload.taskStatus === "created"
        ? payload.taskStatus
        : "posted";

    return {
      ...base,
      vkUrl,
      vkGroupId,
      taskStatus,
    };
  }
  return base;
}

export async function executeMockJob(job: WorkerJob): Promise<Record<string, unknown>> {
  const tasks = readVkTasksFile();
  const task = tasks.find((item) => item.id === job.taskId);
  if (!task || task.status !== "ready_for_worker") {
    throw new VkWorkerSkipError(`Задача ${job.taskId} не в статусе ready_for_worker`, {});
  }

  assertTaskReadyForWorkerAction(task, job.action);

  await sleep(randomMockDelayMs());
  const result = buildMockResult(job);

  if (result.skipped === true) {
    throw new VkWorkerSkipError(String(result.message ?? "Skipped"), result);
  }

  return result;
}
