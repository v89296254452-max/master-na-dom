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
    <section className="rounded-2xl border border-gray-border bg-white p-6 sm:p-8 shadow-sm">
      <SectionHeading
        title="Типовые проблемы"
        subtitle={`${service} в ${cityPrepositional} — частые неисправности`}
      />

      <ul className="grid gap-2 sm:grid-cols-2">
        {problems.map((item) => (
          <li key={item.slug}>
            <Link
              href={item.href}
              className="flex items-center gap-2 rounded-xl border border-gray-border bg-gray-card px-4 py-3 text-sm font-medium text-navy hover:border-orange/40 hover:text-orange transition-colors"
            >
              <span className="text-orange">✔</span>
              {item.problemTitle}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-navy/5 border border-gray-border p-4">
        <div>
          <p className="font-semibold text-navy">Нужен мастер?</p>
          <p className="text-sm text-navy-muted mt-1">Звонки принимаем 24/7</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href={targetUrl}
            className="inline-flex items-center justify-center rounded-xl bg-orange px-6 py-3 text-sm font-semibold text-white hover:bg-orange-dark transition-colors"
          >
            Вызвать мастера
          </Link>
          <a href={phoneHref} className="text-lg font-bold text-navy hover:text-orange">
            {phone}
          </a>
        </div>
      </div>

      <p className="mt-4 text-sm">
        <Link href="/problem" className="text-orange hover:underline font-medium">
          Все типовые проблемы →
        </Link>
      </p>
    </section>
  );
}
