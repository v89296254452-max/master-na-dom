import path from "path";
import { getAllPages } from "../lib/pages";
import { generateVkPlanFromPages, writeVkPlanCsv } from "../lib/vk-plan";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://master-na-dom.online").replace(
  /\/+$/,
  ""
);

const OUTPUT_PATH = path.join(process.cwd(), "data", "vk-plan.csv");

function main() {
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
  }

  const pages = getAllPages();
  const rows = generateVkPlanFromPages(pages);
  const count = writeVkPlanCsv(rows, OUTPUT_PATH);

  const groups = rows.reduce(
    (acc, row) => {
      acc[row.accountGroup] = (acc[row.accountGroup] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const sample = rows.find((row) => row.slug === "kp-abakan");

  console.log(`Сгенерирован план VK-сообществ: ${count} записей`);
  console.log(`Базовый URL: ${SITE_URL}`);
  console.log(`Файл: ${OUTPUT_PATH}`);
  console.log("Группы аккаунтов:", groups);
  if (sample) {
    console.log(`Пример siteUrl: ${sample.siteUrl}`);
  }
}

main();
