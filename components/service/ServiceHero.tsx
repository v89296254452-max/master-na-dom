import { BENEFITS, getHeroSubtitle } from "@/lib/service-ui";
import type { Page } from "@/lib/pages";

interface ServiceHeroProps {
  page: Page;
  phone: string;
  phoneHref: string;
}

export default function ServiceHero({ page, phone, phoneHref }: ServiceHeroProps) {
  const subtitle = getHeroSubtitle(page);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-card to-white border border-gray-border p-6 sm:p-8">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange/5" />
      <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-navy/5" />

      <div className="relative">
        <p className="mb-2 text-sm font-medium text-orange">
          Служба мастеров в {page.cityPrepositional || page.city || "городе"}
        </p>
        <h1 className="text-2xl font-bold leading-tight text-navy sm:text-3xl lg:text-4xl">
          {page.h1 || `${page.service || "Услуга"} — выезд мастера`}
        </h1>
        <p className="mt-3 text-base text-navy-muted sm:text-lg">{subtitle}</p>

        <a
          href={phoneHref}
          className="mt-5 inline-block text-2xl font-bold text-navy sm:text-3xl"
        >
          {phone}
        </a>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={phoneHref}
            className="inline-flex items-center justify-center rounded-xl bg-orange px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-orange-dark"
          >
            Позвонить
          </a>
          <a
            href="#lead-form"
            className="inline-flex items-center justify-center rounded-xl border-2 border-navy/15 bg-white px-6 py-3.5 text-base font-semibold text-navy transition-colors hover:border-navy/30 hover:bg-gray-card"
          >
            Оставить заявку
          </a>
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {BENEFITS.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-3 rounded-xl bg-white/80 p-4 border border-gray-border"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange/10 text-orange">
                ✓
              </span>
              <div>
                <p className="font-semibold text-navy text-sm">{item.title}</p>
                <p className="text-xs text-navy-muted mt-0.5">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
