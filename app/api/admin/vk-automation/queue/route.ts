import { NextResponse } from "next/server";
import {
  enqueueAuthCheck,
  enqueueAuthOpen,
  enqueueBatchCreateGroups,
  enqueueCreateGroupForTask,
  enqueueCreateTestGroup,
  enqueueJob,
  getQueueOverview,
} from "@/lib/vk-automation/queue";
import { VK_BROWSER_JOB_ACTIONS } from "@/lib/vk-automation/types";
import { claimNextJob, completeJob } from "@/lib/vk-automation/db";
import { VK_AUTOMATION_CONFIG } from "@/lib/vk-automation/config";

function isAction(value: unknown): value is typeof VK_BROWSER_JOB_ACTIONS[number] {
  return typeof value === "string" && VK_BROWSER_JOB_ACTIONS.includes(value as typeof VK_BROWSER_JOB_ACTIONS[number]);
}

export async function GET() {
  try {
    const overview = getQueueOverview();
    return NextResponse.json({ success: true, ...overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка очереди";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";

    if (!accountId && action !== "batch") {
      return NextResponse.json({ success: false, error: "accountId обязателен" }, { status: 400 });
    }

    let job;

    switch (action) {
      case "auth_open":
        job = enqueueAuthOpen(accountId);
        break;
      case "auth_check":
        job = enqueueAuthCheck(accountId);
        break;
      case "create_test_group":
        job = enqueueCreateTestGroup(accountId);
        break;
      case "create_group":
        const taskId = Number(body.taskId);
        if (!Number.isFinite(taskId)) {
          return NextResponse.json({ success: false, error: "taskId обязателен" }, { status: 400 });
        }
        job = enqueueCreateGroupForTask(taskId, accountId);
        break;
      case "batch":
        const accountIds = Array.isArray(body.accountIds)
          ? body.accountIds.filter((id: unknown) => typeof id === "string")
          : [];
        const limit = Number(body.limit) || 10;
        const jobs = enqueueBatchCreateGroups(accountIds, limit);
        return NextResponse.json({ success: true, jobs, count: jobs.length });
      case "custom":
        if (!isAction(body.jobAction)) {
          return NextResponse.json({ success: false, error: "Некорректный jobAction" }, { status: 400 });
        }
        job = enqueueJob({
          accountId,
          action: body.jobAction,
          taskId: body.taskId ? Number(body.taskId) : null,
          payload: body.payload as Record<string, unknown> | undefined,
        });
        break;
      default:
        return NextResponse.json({ success: false, error: "Неизвестное действие" }, { status: 400 });
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать задачу";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const job = claimNextJob();
    return NextResponse.json({ success: true, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось взять задачу";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
    const status = body.status as "success" | "failed" | "skipped";

    if (!jobId || !status) {
      return NextResponse.json({ success: false, error: "jobId и status обязательны" }, { status: 400 });
    }

    const job = completeJob(
      jobId,
      status,
      body.result as Record<string, unknown> | undefined,
      typeof body.error === "string" ? body.error : "",
      body.retry === true,
      Number(body.maxAttempts) || VK_AUTOMATION_CONFIG.workerMaxAttempts
    );

    return NextResponse.json({ success: true, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось завершить задачу";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
