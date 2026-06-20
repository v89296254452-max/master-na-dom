"use client";

interface StickyCallBarProps {
  phone: string;
  phoneHref: string;
}

export default function StickyCallBar({ phone, phoneHref }: StickyCallBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-border bg-white p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
      <a
        href={phoneHref}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange py-3.5 text-base font-bold text-white transition-colors active:bg-orange-dark"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-1.084 1.452a11.042 11.042 0 01-5.516-5.517l1.452-1.084c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
        Позвонить · {phone}
      </a>
    </div>
  );
}
