import Link from "next/link";
import type { ProblemListItem } from "@/lib/problem-types";
import SectionHeading from "@/components/service/SectionHeading";

interface TypicalProblemsBlockProps {
  problems: ProblemListItem[];
  service: string;
  cityPrepositional: string;
  targetUrl: string;
  phone: string;
  phoneHref: string;
}

export default function TypicalProblemsBlock({
  problems,
  service,
  cityPrepositional,
  targetUrl,
  phone,
  phoneHref,
}: TypicalProblemsBlockProps) {
  if (problems.length === 0) return null;

  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading
          title="Типовые проблемы"
          subtitle={`${service} в ${cityPrepositional} — частые неисправности`}
        />

        <ul className="grid gap-2 sm:grid-cols-2">
          {problems.map((item) => (
            <li key={item.slug}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-[0.9375rem] text-ink transition-colors hover:border-accent hover:text-accent"
              >
                <span className="h-2 w-2 shrink-0 rounded-[2px] bg-accent" aria-hidden />
                {item.problemTitle}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-accent-light p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink">Нужен мастер?</p>
            <p className="mt-1 text-sm text-muted">Звонки принимаем 24/7</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Link
              href={targetUrl}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Вызвать мастера
            </Link>
            <a href={phoneHref} className="text-lg font-bold text-ink transition-colors hover:text-accent">
              {phone}
            </a>
          </div>
        </div>

        <p className="mt-4 text-sm">
          <Link href="/problem" className="font-medium text-accent hover:underline">
            Все типовые проблемы →
          </Link>
        </p>
      </div>
    </section>
  );
}
