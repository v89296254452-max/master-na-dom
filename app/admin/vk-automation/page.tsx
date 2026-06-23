import type { Metadata } from "next";
import VkAutomationPanel from "./VkAutomationPanel";

export const metadata: Metadata = {
  title: "VK Browser Automation",
  robots: { index: false, follow: false },
};

export default function VkAutomationAdminPage() {
  return <VkAutomationPanel />;
}
