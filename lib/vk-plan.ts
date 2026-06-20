import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { getAllPages, type Page } from "./pages";
import { buildVkPlanRow } from "./vk-generator";
import type { VkPlanRow } from "./vk-types";

const VK_PLAN_COLUMNS: (keyof VkPlanRow)[] = [
  "city",
  "service",
  "slug",
  "phone",
  "siteUrl",
  "vkName",
  "vkDescription",
  "vkStatus",
  "vkFirstPost",
  "vkKeywords",
  "accountGroup",
  "status",
];

const VK_PLAN_PATH = path.join(process.cwd(), "data", "vk-plan.csv");

export type VkPlanLoadResult =
  | { ok: true; rows: VkPlanRow[]; path: string }
  | { ok: false; error: string; path: string };

function parseVkPlanCsv(content: string): VkPlanRow[] {
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  return rows.map((row) => ({
    city: row.city ?? "",
    service: row.service ?? "",
    slug: row.slug ?? "",
    phone: row.phone ?? "",
    siteUrl: row.siteUrl ?? "",
    vkName: row.vkName ?? "",
    vkDescription: row.vkDescription ?? "",
    vkStatus: row.vkStatus ?? "",
    vkFirstPost: row.vkFirstPost ?? "",
    vkKeywords: row.vkKeywords ?? "",
    accountGroup: (row.accountGroup as VkPlanRow["accountGroup"]) ?? "mnch",
    status: row.status ?? "pending",
  }));
}

export function loadVkPlanStrict(): VkPlanLoadResult {
  if (!fs.existsSync(VK_PLAN_PATH)) {
    return {
      ok: false,
      path: VK_PLAN_PATH,
      error:
        "Файл data/vk-plan.csv не найден. Сгенерируйте план командой: npm run generate:vk",
    };
  }

  try {
    const content = fs.readFileSync(VK_PLAN_PATH, "utf-8");
    const rows = parseVkPlanCsv(content);

    if (rows.length === 0) {
      return {
        ok: false,
        path: VK_PLAN_PATH,
        error: "Файл data/vk-plan.csv пуст. Запустите: npm run generate:vk",
      };
    }

    return { ok: true, rows, path: VK_PLAN_PATH };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    return {
      ok: false,
      path: VK_PLAN_PATH,
      error: `Не удалось прочитать data/vk-plan.csv: ${message}`,
    };
  }
}


function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function vkPlanToCsv(rows: VkPlanRow[]): string {
  const header = VK_PLAN_COLUMNS.join(",");
  const lines = rows.map((row) =>
    VK_PLAN_COLUMNS.map((col) => escapeCsvField(row[col] ?? "")).join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}

export function writeVkPlanCsv(rows: VkPlanRow[], outputPath = VK_PLAN_PATH): number {
  fs.writeFileSync(outputPath, vkPlanToCsv(rows), "utf-8");
  return rows.length;
}

export function generateVkPlanFromPages(pages: Page[]): VkPlanRow[] {
  return pages.filter((p) => p.slug && p.city && p.service).map((page) => buildVkPlanRow(page));
}

export function loadVkPlan(): VkPlanRow[] {
  if (!fs.existsSync(VK_PLAN_PATH)) {
    return generateVkPlanFromPages(getAllPages());
  }

  const content = fs.readFileSync(VK_PLAN_PATH, "utf-8");
  return parseVkPlanCsv(content);
}
