import type { Metadata } from "next";
import { preload } from "react-dom";
import YandexMetrika from "@/components/YandexMetrika";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "ПроМастер — бытовые услуги",
  description: "Вызов мастера на дом: сантехник, электрик, ремонт техники. Работаем по всем районам.",
  openGraph: {
    title: "ПроМастер — бытовые услуги",
    description: "Вызов мастера на дом: сантехник, электрик, ремонт техники. Работаем по всем районам.",
    siteName: "ПроМастер",
    locale: "ru_RU",
    type: "website",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
    shortcut: [{ url: "/favicon.png", type: "image/png" }],
  },
  verification: {
    yandex: "e6f0a54a781c1bb3",
    // Google Search Console: задать GOOGLE_SITE_VERIFICATION в .env.local
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Preload ключевых шрифтов (LCP-текст): H1 (Manrope 800) + body (Onest 400).
  preload("/fonts/manrope-800-cyrillic.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload("/fonts/onest-400-cyrillic.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">
        {/* First-touch атрибуция: ловим UTM/yclid сразу при загрузке (до React),
            чтобы не потерять метку платного трафика при медленной гидрации. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var u=new URL(location.href),p=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","yclid","gclid","roistat","_openstat","erid"],f={},h=false;p.forEach(function(k){var v=u.searchParams.get(k);if(v){f[k]=v.slice(0,200);h=true}});if(!h)return;if(document.cookie.indexOf("pm_attr=")>-1)return;f.referrer=(document.referrer||"").slice(0,200);f.landing=u.pathname.slice(0,200);var e=new Date(Date.now()+7776e6).toUTCString();document.cookie="pm_attr="+encodeURIComponent(JSON.stringify(f))+"; expires="+e+"; path=/; SameSite=Lax"}catch(e){}})();',
          }}
        />
        {children}
        <YandexMetrika />
      </body>
    </html>
  );
}
