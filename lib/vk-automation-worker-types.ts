import type { VkAutomationAction } from "./vk-automation-queue-types";



export interface WorkerJob {

  id: string;

  taskId: string;

  accountId: string;

  action: VkAutomationAction;

  payload?: Record<string, unknown>;

}



export const TASK_NOT_READY_VK_GROUP_ID = "Task is not ready: vkGroupId missing";



const VK_GROUP_REQUIRED_ACTIONS = new Set<VkAutomationAction>([
  "setup_group",
  "fill_description",
  "upload_cover",
  "upload_avatar",
  "publish_pinned_post",
  "publish_post",
  "save_result",
]);



export function actionRequiresVkGroupId(action: VkAutomationAction): boolean {

  return VK_GROUP_REQUIRED_ACTIONS.has(action);

}



export class VkWorkerSkipError extends Error {

  result: Record<string, unknown>;



  constructor(message: string, result: Record<string, unknown>) {

    super(message);

    this.name = "VkWorkerSkipError";

    this.result = result;

  }

}



export class VkWorkerNotReadyError extends Error {

  constructor(message: string = TASK_NOT_READY_VK_GROUP_ID) {

    super(message);

    this.name = "VkWorkerNotReadyError";

  }

}



export function isWorkerSkipError(error: unknown): error is VkWorkerSkipError {

  return error instanceof VkWorkerSkipError;

}



export function isWorkerNotReadyError(error: unknown): error is VkWorkerNotReadyError {

  return error instanceof VkWorkerNotReadyError;

}



export function assertTaskReadyForWorkerAction(

  task: { vkGroupId: string },

  action: VkAutomationAction

): void {

  if (!actionRequiresVkGroupId(action)) {

    return;

  }



  if (!task.vkGroupId.trim()) {

    throw new VkWorkerNotReadyError(TASK_NOT_READY_VK_GROUP_ID);

  }

}


