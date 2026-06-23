import type { VkAutomationAction, VkAutomationJob, VkAutomationJobStatus } from "./vk-automation-queue-types";

/** Posts Only pipeline — без groups.edit / setup_group. */
export const WORKER_PIPELINE = [
  "login_account",
  "upload_avatar",
  "publish_pinned_post",
  "publish_post",
  "save_result",
] as const satisfies readonly VkAutomationAction[];

export type WorkerPipelineAction = (typeof WORKER_PIPELINE)[number];

const PIPELINE_SET = new Set<VkAutomationAction>(WORKER_PIPELINE);

/** Шаги, для которых допустим skipped у непосредственного предшественника. */
const SKIPPED_PREDECESSOR_OK: Partial<Record<WorkerPipelineAction, WorkerPipelineAction>> = {
  publish_pinned_post: "upload_avatar",
};

export function isWorkerPipelineAction(action: VkAutomationAction): action is WorkerPipelineAction {
  return PIPELINE_SET.has(action);
}

export function pipelineJobId(taskId: string, action: VkAutomationAction): string {
  return `${taskId}::${action}`;
}

export function getPipelineIndex(action: VkAutomationAction): number {
  return WORKER_PIPELINE.indexOf(action as WorkerPipelineAction);
}

export function getPredecessorAction(action: WorkerPipelineAction): WorkerPipelineAction | null {
  const index = getPipelineIndex(action);
  if (index <= 0) return null;
  return WORKER_PIPELINE[index - 1] ?? null;
}

export function findTaskPipelineJob(
  jobs: VkAutomationJob[],
  taskId: string,
  action: WorkerPipelineAction
): VkAutomationJob | undefined {
  const id = pipelineJobId(taskId, action);
  return jobs.find((job) => job.id === id || (job.taskId === taskId && job.action === action));
}

export type PredecessorCheck = "ok" | "wait" | "block";

export function checkPredecessorForClaim(
  jobs: VkAutomationJob[],
  taskId: string,
  action: WorkerPipelineAction
): PredecessorCheck {
  const predecessor = getPredecessorAction(action);
  if (!predecessor) {
    return "ok";
  }

  const predJob = findTaskPipelineJob(jobs, taskId, predecessor);
  if (!predJob) {
    return "wait";
  }

  if (predJob.status === "failed") {
    return "block";
  }

  if (predJob.status === "pending" || predJob.status === "running") {
    return "wait";
  }

  if (predJob.status === "success") {
    return "ok";
  }

  if (predJob.status === "skipped") {
    const allowed = SKIPPED_PREDECESSOR_OK[action] === predecessor;
    return allowed ? "ok" : "block";
  }

  return "wait";
}

export function predecessorFailureMessage(action: WorkerPipelineAction): string {
  const predecessor = getPredecessorAction(action);
  return predecessor ? `Previous step failed: ${predecessor}` : "Previous step failed";
}

export function skipPendingJob(
  job: VkAutomationJob,
  reason: string,
  timestamp: string
): VkAutomationJob {
  return {
    ...job,
    status: "skipped",
    error: reason,
    updatedAt: timestamp,
    completedAt: timestamp,
  };
}

/**
 * Помечает pending jobs как skipped, если обязательный предшественник failed/skipped (где skipped не допустим).
 * Возвращает true, если что-то изменилось.
 */
export function enforcePipelineSkipsForBlockedPending(jobs: VkAutomationJob[]): boolean {
  const timestamp = new Date().toISOString();
  let changed = false;

  for (const taskId of new Set(jobs.map((job) => job.taskId))) {
    for (const action of WORKER_PIPELINE) {
      const job = findTaskPipelineJob(jobs, taskId, action);
      if (!job || job.status !== "pending") continue;

      const check = checkPredecessorForClaim(jobs, taskId, action);
      if (check !== "block") continue;

      const index = jobs.findIndex((item) => item.id === job.id);
      if (index === -1) continue;

      jobs[index] = skipPendingJob(job, predecessorFailureMessage(action), timestamp);
      changed = true;
    }
  }

  return changed;
}

export interface TaskPipelineOverviewRow {
  taskId: string;
  accountId: string;
  steps: Record<WorkerPipelineAction, VkAutomationJobStatus | "—">;
}

export function buildTaskPipelineOverview(jobs: VkAutomationJob[]): TaskPipelineOverviewRow[] {
  const taskIds = new Set<string>();

  for (const job of jobs) {
    if (isWorkerPipelineAction(job.action)) {
      taskIds.add(job.taskId);
    }
  }

  return Array.from(taskIds)
    .sort()
    .map((taskId) => {
      const steps = {} as Record<WorkerPipelineAction, VkAutomationJobStatus | "—">;
      let accountId = "";

      for (const action of WORKER_PIPELINE) {
        const job = findTaskPipelineJob(jobs, taskId, action);
        steps[action] = job?.status ?? "—";
        if (job?.accountId && !accountId) {
          accountId = job.accountId;
        }
      }

      return { taskId, accountId, steps };
    });
}

export function sortPendingJobsForClaim(jobs: VkAutomationJob[]): number[] {
  const indices: Array<{ index: number; pipelineIndex: number; createdAt: string }> = [];

  jobs.forEach((job, index) => {
    if (job.status !== "pending" || !isWorkerPipelineAction(job.action)) return;
    indices.push({
      index,
      pipelineIndex: getPipelineIndex(job.action),
      createdAt: job.createdAt,
    });
  });

  indices.sort((a, b) => {
    if (a.pipelineIndex !== b.pipelineIndex) return a.pipelineIndex - b.pipelineIndex;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return indices.map((item) => item.index);
}
