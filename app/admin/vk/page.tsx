import type { Metadata } from "next";
import VkTasksTable from "./VkTasksTable";

export const metadata: Metadata = {
  title: "VK Генератор сообществ",
  robots: { index: false, follow: false },
};

export default function VkAdminPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">VK Генератор сообществ</h1>
        <p className="mt-2 max-w-3xl text-sm text-navy-muted sm:text-base">
          Очередь задач для ручного создания VK-сообществ. Изменения сохраняются в{" "}
          <code className="rounded bg-gray-card px-1.5 py-0.5">data/vk-tasks.json</code>.
        </p>
        <p className="mt-3 text-xs text-navy-muted sm:text-sm">
          План: <code className="rounded bg-gray-card px-1.5 py-0.5">data/vk-plan.csv</code>
          {" · "}
          Обновить план: <code className="rounded bg-gray-card px-1.5 py-0.5">npm run generate:vk</code>
        </p>
      </header>

      <VkTasksTable />
    </main>
  );
}
