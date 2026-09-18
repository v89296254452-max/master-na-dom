import { phoneForService } from "@/lib/phones";

export default function InArticleCTA({ serviceSlug = "" }: { serviceSlug?: string }) {
  const { display: PHONE, href: PHONE_HREF } = phoneForService(serviceSlug);
  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-6 my-8 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <p className="text-lg font-bold text-ink">
          Нужен мастер? Вызовите специалиста прямо сейчас
        </p>
        <p className="mt-1 text-muted">
          Бесплатная диагностика, гарантия на работы, выезд в день обращения.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:items-end">
        <a
          href={PHONE_HREF}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Вызвать мастера
        </a>
        <a href={PHONE_HREF} className="font-semibold text-primary">
          {PHONE}
        </a>
      </div>
    </div>
  );
}
