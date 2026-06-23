/** Client-safe snapshot from GET /api/vk-task-status */
export interface VkTaskStatusSnapshot {
  readyForWorkerTasks: number;
  readyForWorkerStrict: number;
  readyForWorkerEligible: number;
  brokenReadyWithoutGroupId: number;
  vkUrlNoGroupId: number;
  needManualCheck: number;
  groupsCreated: number;
  vkUrlNoGroupIdTaskIds: string[];
  strictReadyTaskIds: string[];
}
