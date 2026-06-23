import type { Metadata } from "next";
import VkImportPanel from "./VkImportPanel";

export const metadata: Metadata = {
  title: "VK Import — импорт данных",
  robots: { index: false, follow: false },
};

export default function VkImportPage() {
  return <VkImportPanel />;
}
