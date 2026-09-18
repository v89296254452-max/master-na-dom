import Link from "next/link";
import SectionHeading from "./SectionHeading";

interface LinkItem {
  slug: string;
  label: string;
}

interface RelatedProblemsProps {
  parentHref: string;
  parentLabel: string;
  sameCity: LinkItem[];
  otherCities: LinkItem[];
}

function Pill({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-ink transition-colors hover:border-accent hover:bg-accent-light hover:text-accent"
    >
      {label}
    </Link>
  );
}

export default function RelatedProblems({
  parentHref,
  parentLabel,
  sameCity,
  otherCities,
}: RelatedProblemsProps) {
  return (
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title="Похожие запросы" subtitle="Другие частые проблемы и города" />

        <div className="rounded-xl border border-border border-l-[3px] border-l-accent bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-muted">Все услуги направления:</p>
          <Link
            href={parentHref}
            className="mt-1 inline-block font-semibold text-accent hover:underline"
          >
            {parentLabel} →
          </Link>
        </div>

        {sameCity.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.05em] text-faint">
              Другие проблемы в этом городе
            </h3>
            <div className="flex flex-wrap gap-2">
              {sameCity.map((item) => (
                <Pill key={item.slug} href={`/problem-service/${item.slug}`} label={item.label} />
              ))}
            </div>
          </div>
        )}

        {otherCities.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.05em] text-faint">
              Эта же проблема в других городах
            </h3>
            <div className="flex flex-wrap gap-2">
              {otherCities.map((item) => (
                <Pill key={item.slug} href={`/problem-service/${item.slug}`} label={item.label} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
