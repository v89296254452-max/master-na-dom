import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Обзор", icon: "M3 13l3 3 3-3 3 3 3-3 3 3v6H3z M3 9l3 3 3-3 3 3 3-3 3 3 3-3" },
  { href: "/admin/leads", label: "Заявки", icon: "M3 7h18l-2 13H5z M9 7V5a3 3 0 0 1 6 0v2" },
  { href: "/admin/campaigns", label: "Кампании", icon: "M3 3v18h18 M18 9l-5 5-3-3-4 4" },
  { href: "/admin/content", label: "Контент", icon: "M9 13a4 4 0 1 0 4 4V5l8-2v10.5" },
  { href: "/admin/coverage", label: "Покрытие", icon: "M12 21s-7-6.3-7-11a7 7 0 0114 0c0 4.7-7 11-7 11z M12 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" },
  { href: "/admin/pages", label: "Страницы", icon: "M4 4h16v16H4z M4 9h16 M9 9v11" },
  { href: "/admin/seo", label: "SEO", icon: "M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z" },
  { href: "/admin/vk", label: "VK", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/admin/dzen", label: "Дзен", icon: "M3 3v18h18 M7 14l4-4 4 4 5-5" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-root admin-scrollbar min-h-screen bg-adm-abyss-900 text-adm-ink-100 antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div className="flex min-h-screen">
        {/* Sidebar (lg+) */}
        <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-adm-abyss-800/80 backdrop-blur border-r border-adm-abyss-600 sticky top-0 h-screen">
          <div className="px-5 py-5 border-b border-adm-abyss-600">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-gradient-to-br from-adm-brand-500 to-adm-purp flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-adm-brand-500/30">
                П
              </div>
              <div>
                <div className="font-bold text-base leading-tight text-adm-ink-0">ПроМастер</div>
                <div className="text-[11px] uppercase tracking-wider text-adm-ink-400">Admin</div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto admin-scrollbar px-3 py-4 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium text-adm-ink-300 transition hover:bg-adm-abyss-700/60 hover:text-adm-ink-0"
              >
                <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-adm-abyss-600 p-3">
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-adm-ink-400 hover:bg-adm-abyss-700/60 hover:text-adm-ink-0"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
              Открыть сайт
            </Link>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar (mobile logo + nav). НЕ <header> — глобальное правило header{} в
              globals.css (белый фон сайта) течёт в админку из-за cascade layers. */}
          <div className="sticky top-0 z-20 bg-adm-abyss-900/90 backdrop-blur border-b border-adm-abyss-600 px-4 lg:px-6 h-14 flex items-center gap-3">
            <Link href="/admin" className="lg:hidden flex items-center gap-2">
              <div className="size-8 rounded-lg bg-gradient-to-br from-adm-brand-500 to-adm-purp flex items-center justify-center text-white font-bold shadow-lg shadow-adm-brand-500/30">
                П
              </div>
              <span className="font-bold text-adm-ink-0">ПроМастер Admin</span>
            </Link>
            <nav className="hidden lg:flex ml-auto items-center gap-1 text-sm">
              {/* На десктопе дублируем ключевые пункты в топбаре не нужно — sidebar уже есть */}
            </nav>
          </div>

          {/* Mobile nav (compact, scrollable) */}
          <nav className="lg:hidden flex gap-1 overflow-x-auto admin-scrollbar border-b border-adm-abyss-600 bg-adm-abyss-800/60 px-3 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-adm-ink-300 hover:bg-adm-abyss-700 hover:text-adm-ink-0"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <main className="flex-1 px-4 lg:px-6 py-5 pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
