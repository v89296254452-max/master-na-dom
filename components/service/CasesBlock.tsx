import type { ServiceCase } from "@/lib/seo/cases";
import SectionHeading from "./SectionHeading";

interface CasesBlockProps {
  cases: ServiceCase[];
}

const LABEL = "text-xs font-semibold uppercase tracking-[0.05em] text-faint";

export default function CasesBlock({ cases }: CasesBlockProps) {
  if (cases.length === 0) return null;

  return (
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading
          title="Недавние обращения"
          subtitle="Примеры выполненных работ наших мастеров"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            >
              <h3 className="border-b border-border pb-3.5 font-semibold text-ink">{item.title}</h3>
              <dl className="mt-3.5 space-y-3 text-sm">
                <div>
                  <dt className={LABEL}>Проблема</dt>
                  <dd className="mt-0.5 text-ink">{item.problem}</dd>
                </div>
                <div>
                  <dt className={LABEL}>Решение</dt>
                  <dd className="mt-0.5 text-ink">{item.solution}</dd>
                </div>
                <div className="flex gap-6 pt-1">
                  <div>
                    <dt className={LABEL}>Стоимость</dt>
                    <dd className="mt-0.5 font-semibold text-accent">{item.price}</dd>
                  </div>
                  <div>
                    <dt className={LABEL}>Время</dt>
                    <dd className="mt-0.5 text-muted">{item.duration}</dd>
                  </div>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
