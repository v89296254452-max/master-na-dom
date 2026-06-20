import type { Metadata } from "next";
import YandexMetrika from "@/components/YandexMetrika";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Master Leads — бытовые услуги",
  description: "Вызов мастера на дом: сантехник, электрик, ремонт техники. Работаем по всем районам.",
  verification: {
    yandex: "e6f0a54a781c1bb3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">
        {children}
        <YandexMetrika />
      </body>
    </html>
  );
}
