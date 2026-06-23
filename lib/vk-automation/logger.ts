import { insertLogEntry } from "./db";

export type VkAutomationLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, screenshotPath?: string) => void;
};

export function createJobLogger(jobId: string, accountId: string): VkAutomationLogger {
  const write = (
    level: "info" | "warn" | "error",
    message: string,
    screenshotPath = ""
  ): void => {
    const prefix = `[vk-worker] job=${jobId} account=${accountId}`;
    const line = `${prefix} ${message}`;
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
    insertLogEntry({
      jobId,
      accountId,
      level,
      message,
      screenshotPath,
    });
  };

  return {
    info: (message) => write("info", message),
    warn: (message) => write("warn", message),
    error: (message, screenshotPath) => write("error", message, screenshotPath ?? ""),
  };
}
