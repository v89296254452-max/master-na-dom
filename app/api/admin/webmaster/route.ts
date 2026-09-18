import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { getActiveProblems, getInSearchHistory, getInSearchSamples, getQueryHistory, getRecrawlQuota, getSummary } from "@/lib/webmaster";

const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    const [summary, problems, inSearch, quota, history, queries] = await Promise.all([
      getSummary(),
      getActiveProblems(),
      getInSearchSamples(8),
      getRecrawlQuota(),
      getInSearchHistory(30),
      getQueryHistory(30),
    ]);
    return NextResponse.json({ success: true, summary, problems, inSearch, quota, history, queries });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Ошибка" }, { status: 500 });
  }
}

/** Ручной запуск приоритетного переобхода (та же логика, что и в ежедневном кроне). */
export async function POST() {
  try {
    const { stdout } = await execFileAsync("node", ["scripts/yandex-recrawl.mjs"], {
      cwd: process.cwd(),
      timeout: 120000,
    });
    return NextResponse.json({ success: true, log: stdout.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
