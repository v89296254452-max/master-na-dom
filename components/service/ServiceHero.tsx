import Link from "next/link";
import type { Page } from "@/lib/pages";
import type { PageVisual } from "@/lib/images";
import { EXTENDED_BENEFITS, HERO_BENEFITS, HERO_STATS, WORKING_HOURS } from "@/lib/seo/constants";
import { getHeroSubtitle } from "@/lib/service-ui";
import BrandLogo from "./BrandLogo";
import VisualImage from "./VisualImage";

interface ServiceHeroProps {
  page: Page;
  phone: string;
  phoneHref: string;
  logoSrc: string;
  heroVisual: PageVisual;
}

const BENEFIT_ICONS: Record<string, string> = {
  clock: "🕐",
  bolt: "⚡",
  shield: "🛡",
};

export default function ServiceHero({ page, phone, phoneHref, logoSrc, heroVisual }: ServiceHeroProps) {
  const subtitle = getHeroSubtitle(page);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-gray-border bg-gradient-to-br from-navy via-navy-light to-navy text-white shadow-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.15),transparent_50%)]" />

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_minmax(220px,280px)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-4">
            <BrandLogo src={logoSrc} />
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm backdrop-blur-sm">
              <span className="text-orange">★</span>
              <span className="font-semibold">{HERO_STATS.rating}</span>
              <span className="text-white/70">· {HERO_STATS.orders} заявок</span>
            </div>
            <span className="rounded-full bg-orange px-3 py-1 text-xs font-bold lg:hidden">
              Гарантия {HERO_STATS.guarantee}
            </span>
          </div>

          <p className="mt-4 text-sm font-medium text-orange">
            {WORKING_HOURS.title} · {WORKING_HOURS.schedule}
          </p>

          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            {page.h1 || `${page.service || "Услуга"} — выезд мастера`}
          </h1>

          <p className="mt-3 text-base text-white/80 sm:text-lg">{subtitle}</p>

          <div className="mt-5 flex flex-wrap gap-3">
            {HERO_BENEFITS.map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm backdrop-blur-sm"
              >
                <span>{BENEFIT_ICONS[item.icon]}</span>
                <span className="font-semibold">{item.title}</span>
                <span className="text-white/60">{item.desc}</span>
              </div>
            ))}
          </div>

          <a
            href={phoneHref}
            className="mt-6 inline-block text-2xl font-bold tracking-tight transition-colors hover:text-orange sm:text-3xl lg:text-4xl"
          >
            {phone}
          </a>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={phoneHref}
              className="inline-flex items-center justify-center rounded-xl bg-orange px-8 py-4 text-base font-semibold text-white shadow-lg shadow-orange/25 transition-all hover:bg-orange-dark hover:shadow-orange/40"
            >
              Вызвать мастера
            </a>
            <Link
              href="#lead-form"
              className="inline-flex items-center justify-center rounded-xl border-2 border-white/25 bg-white/10 px-8 py-4 text-base font-semibold backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Оставить заявку
            </Link>
          </div>

          <ul className="mt-8 grid gap-2 sm:grid-cols-2">
            {EXTENDED_BENEFITS.slice(0, 4).map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-white/90">
                <span className="text-orange">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[280px] lg:mx-0 lg:justify-self-end">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border-2 border-white/20 shadow-2xl">
            <VisualImage visual={heroVisual} variant="hero" priority />
          </div>
          <div className="absolute -bottom-3 -left-3 hidden rounded-xl bg-orange px-4 py-2 text-sm font-bold shadow-lg lg:block">
            Гарантия {HERO_STATS.guarantee}
          </div>
        </div>
      </div>
    </section>
  );
}
