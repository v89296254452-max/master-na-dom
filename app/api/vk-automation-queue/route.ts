import { NextResponse } from "next/server";
import type { VkAutomationJobCompleteInput } from "@/lib/vk-automation-queue-types";
import {
  claimNextPendingAutomationJob,
  completeAutomationJob,
  ensureVkAutomationQueueFile,
  readVkAutomationQueueFile,
  writeVkAutomationQueueFile,
} from "@/lib/vk-automation-queue";

export async function GET() {
  try {
    const jobs = ensureVkAutomationQueueFile();
    const pending = jobs.filter((job) => job.status === "pending").length;
    const running = jobs.filter((job) => job.status === "running").length;

    return NextResponse.json({
      success: true,
      jobs,
      stats: {
        total: jobs.length,
        pending,
        running,
        success: jobs.filter((job) => job.status === "success").length,
        failed: jobs.filter((job) => job.status === "failed").length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить очередь";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const jobs = readVkAutomationQueueFile();
    const job = claimNextPendingAutomationJob(jobs);

    if (!job) {
      return NextResponse.json({ success: true, job: null, message: "No pending automation jobs" });
    }

    writeVkAutomationQueueFile(jobs);
    return NextResponse.json({ success: true, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось взять задачу из очереди";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";

    if (!jobId) {
      return NextResponse.json({ success: false, error: "jobId обязателен" }, { status: 400 });
    }

    if (body.status !== "success" && body.status !== "failed") {
      return NextResponse.json({ success: false, error: "status должен быть success или failed" }, { status: 400 });
    }

    const input: VkAutomationJobCompleteInput = {
      jobId,
      status: body.status,
      result: body.result && typeof body.result === "object" ? body.result : undefined,
      error: typeof body.error === "string" ? body.error : undefined,
    };

    const jobs = readVkAutomationQueueFile();
    const updated = completeAutomationJob(jobs, input);

    if (!updated) {
      return NextResponse.json({ success: false, error: "Job не найден" }, { status: 404 });
    }

    writeVkAutomationQueueFile(jobs);
    return NextResponse.json({ success: true, job: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось завершить automation job";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
