import type { BrowserContext } from "playwright";
import { VK_AUTOMATION_CONFIG, readPresetText } from "./config";
import { insertGroup, getTaskById, updateTaskStatus } from "./db";
import { checkAuthForAccount } from "./auth";
import { delay, safeScreenshot, withPage } from "./browser";
import {
  clickFirstVisible,
  fillFirstVisible,
  extractGroupIdFromUrl,
  buildGroupUrl,
  waitForUrlChange,
} from "./actions";
import type { VkAutomationLogger } from "./logger";
import type { VkBrowserAccount } from "./types";
import type { VkGroupCreationTask } from "@/lib/master-data/types";
import { readVkTasksFile, updateVkTask, writeVkTasksFile } from "@/lib/vk-tasks";

export interface CreateGroupResult {
  success: boolean;
  groupName: string;
  vkUrl: string;
  vkGroupId: string;
  groupDbId?: number;
  message: string;
}

async function ensureLoggedIn(
  context: BrowserContext,
  account: VkBrowserAccount,
  jobId: string,
  logger: VkAutomationLogger
): Promise<boolean> {
  const check = await checkAuthForAccount(context, account, jobId, logger);
  return check.loggedIn;
}

async function createGroupOnVk(
  context: BrowserContext,
  account: VkBrowserAccount,
  jobId: string,
  groupName: string,
  logger: VkAutomationLogger
): Promise<CreateGroupResult> {
  if (!(await ensureLoggedIn(context, account, jobId, logger))) {
    return {
      success: false,
      groupName: "",
      vkUrl: "",
      vkGroupId: "",
      message: "Аккаунт не авторизован",
    };
  }

  const page = await withPage(context, logger);

  logger.info(`Creating group: ${groupName}`);
  await page.goto(VK_AUTOMATION_CONFIG.vkGroupsUrl, { waitUntil: "domcontentloaded" });
  await delay(1500);

  await clickFirstVisible(
    page,
    [
      'button:has-text("Создать сообщество")',
      'a:has-text("Создать сообщество")',
      '[data-testid="create_community"]',
      ".groups_create_link",
    ],
    logger,
    "create community button"
  );

  await clickFirstVisible(
    page,
    [
      'button:has-text("Бизнес")',
      'div:has-text("Бизнес")',
      'button:has-text("Тематическое")',
      'div:has-text("Тематическое сообщество")',
    ],
    logger,
    "community type"
  );

  const filled = await fillFirstVisible(
    page,
    [
      'input[name="title"]',
      'input[placeholder*="название"]',
      'input[placeholder*="Название"]',
      '[data-testid="community_name"] input',
      "input[type='text']",
    ],
    groupName,
    logger,
    "group name"
  );

  if (!filled) {
    const screenshot = await safeScreenshot(page, account.id, jobId, "create_no_name_field");
    return {
      success: false,
      groupName,
      vkUrl: "",
      vkGroupId: "",
      message: `Не найдено поле названия. Скриншот: ${screenshot}`,
    };
  }

  await clickFirstVisible(
    page,
    [
      'button:has-text("Создать")',
      'button:has-text("Продолжить")',
      'button:has-text("Далее")',
      '[data-testid="submit"]',
    ],
    logger,
    "submit create"
  );

  await delay(3000);
  await waitForUrlChange(page, /vk\.com\/(club|public|[a-z])/i, 20000);

  let vkUrl = page.url();
  let vkGroupId = extractGroupIdFromUrl(vkUrl);

  if (!vkGroupId || vkUrl.includes("act=create")) {
    await delay(2000);
    vkUrl = page.url();
    vkGroupId = extractGroupIdFromUrl(vkUrl);
  }

  if (!vkGroupId) {
    const screenshot = await safeScreenshot(page, account.id, jobId, "create_no_group_url");
    return {
      success: false,
      groupName,
      vkUrl,
      vkGroupId: "",
      message: `Не удалось получить ссылку группы. Скриншот: ${screenshot}`,
    };
  }

  const normalizedUrl = buildGroupUrl(vkGroupId);
  logger.info(`Group created: ${normalizedUrl}`);

  return {
    success: true,
    groupName,
    vkUrl: normalizedUrl,
    vkGroupId,
    message: "Группа создана",
  };
}

export async function createTestGroup(
  context: BrowserContext,
  account: VkBrowserAccount,
  jobId: string,
  logger: VkAutomationLogger
): Promise<CreateGroupResult> {
  const groupName = `Тест группа ${new Date().toLocaleString("ru-RU")}`;
  const result = await createGroupOnVk(context, account, jobId, groupName, logger);

  if (!result.success) return result;

  const group = insertGroup({
    accountId: account.id,
    taskId: null,
    name: groupName,
    vkUrl: result.vkUrl,
    vkGroupId: result.vkGroupId,
    description: "",
    city: "",
    phone: "",
    status: "created",
  });

  return {
    ...result,
    groupDbId: group.id,
    message: "Тестовая группа создана",
  };
}

export async function createGroupFromTask(
  context: BrowserContext,
  account: VkBrowserAccount,
  taskId: number,
  jobId: string,
  logger: VkAutomationLogger
): Promise<CreateGroupResult> {
  const task = getTaskById(taskId);
  if (!task) {
    return {
      success: false,
      groupName: "",
      vkUrl: "",
      vkGroupId: "",
      message: `Task not found: ${taskId}`,
    };
  }

  updateTaskStatus(taskId, "running");

  const descriptionTemplate = readPresetText("groop_discription.txt");
  const groupName = task.groupName || `Сообщество ${task.phone || task.id}`;
  const cityName = task.payload.cityName as string | undefined;

  const createResult = await createGroupOnVk(context, account, jobId, groupName, logger);

  if (!createResult.success) {
    updateTaskStatus(taskId, "failed", createResult.message);
    return createResult;
  }

  const group = insertGroup({
    accountId: account.id,
    taskId,
    name: groupName,
    vkUrl: createResult.vkUrl,
    vkGroupId: createResult.vkGroupId,
    description: descriptionTemplate,
    city: cityName ?? "",
    phone: task.phone,
    status: "created",
  });

  updateTaskStatus(taskId, "success");

  return {
    success: true,
    groupName,
    vkUrl: createResult.vkUrl,
    vkGroupId: createResult.vkGroupId,
    groupDbId: group.id,
    message: "Группа создана из задания",
  };
}

export async function createGroupFromMasterTask(
  context: BrowserContext,
  account: VkBrowserAccount,
  masterTask: VkGroupCreationTask,
  jobId: string,
  logger: VkAutomationLogger
): Promise<CreateGroupResult> {
  const createResult = await createGroupOnVk(
    context,
    account,
    jobId,
    masterTask.groupTitle,
    logger
  );

  if (!createResult.success) {
    return createResult;
  }

  const group = insertGroup({
    accountId: masterTask.accountId,
    taskId: null,
    name: masterTask.groupTitle,
    vkUrl: createResult.vkUrl,
    vkGroupId: createResult.vkGroupId,
    description: masterTask.groupDescription,
    city: masterTask.city,
    phone: masterTask.phone,
    status: "created",
  });

  const tasks = readVkTasksFile();
  const updated = updateVkTask(tasks, masterTask.taskId, {
    vkUrl: createResult.vkUrl,
    vkGroupId: createResult.vkGroupId,
    assignedAccount: masterTask.accountId,
    assignedAt: new Date().toISOString(),
    status: "created",
    manualCreated: false,
  });
  if (updated) {
    writeVkTasksFile(tasks);
    logger.info(`VK task ${masterTask.taskId} updated with group URL`);
  }

  return {
    success: true,
    groupName: masterTask.groupTitle,
    vkUrl: createResult.vkUrl,
    vkGroupId: createResult.vkGroupId,
    groupDbId: group.id,
    message: `Группа создана: ${masterTask.city} / ${masterTask.service} → ${createResult.vkUrl}`,
  };
}
