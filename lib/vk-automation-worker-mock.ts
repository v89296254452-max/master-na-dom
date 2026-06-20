import type { VkAutomationAction } from "./vk-automation-queue-types";

export interface WorkerJob {
  id: string;
  taskId: string;
  accountId: string;
  action: VkAutomationAction;
  payload?: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomMockDelayMs(): number {
  return 1000 + Math.floor(Math.random() * 1000);
}

export function buildMockResult(job: WorkerJob): Record<string, unknown> {
  const base = {
    mock: true,
    message: "Action completed in mock mode",
  };

  if (job.action === "create_group") {
    return {
      ...base,
      vkUrl: `https://vk.com/club_mock_${job.taskId}`,
      vkGroupId: `mock_${job.taskId}`,
    };
  }

  if (job.action === "save_result") {
    const payload = job.payload ?? {};
    const vkUrl =
      typeof payload.vkUrl === "string" && payload.vkUrl.trim()
        ? payload.vkUrl.trim()
        : `https://vk.com/club_mock_${job.taskId}`;
    const vkGroupId =
      typeof payload.vkGroupId === "string" && payload.vkGroupId.trim()
        ? payload.vkGroupId.trim()
        : `mock_${job.taskId}`;
    const taskStatus =
      payload.taskStatus === "posted" || payload.taskStatus === "created"
        ? payload.taskStatus
        : "created";

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
  await sleep(randomMockDelayMs());
  return buildMockResult(job);
}
