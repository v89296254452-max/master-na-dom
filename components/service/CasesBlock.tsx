import type { ServiceCase } from "@/lib/seo/cases";
import SectionHeading from "./SectionHeading";

interface CasesBlockProps {
  cases: ServiceCase[];
}

export default function CasesBlock({ cases }: CasesBlockProps) {
  if (cases.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-border bg-white p-6 sm:p-8 shadow-sm">
      <SectionHeading
        title="Недавние обращения"
        subtitle="Примеры выполненных работ наших мастеров"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {cases.map((item) => (
          <article
            key={item.title}
            className="rounded-xl border border-gray-border bg-gray-card p-5 hover:border-orange/30 transition-colors"
          >
            <h3 className="font-semibold text-navy">{item.title}</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-navy-muted">Проблема</dt>
                <dd className="font-medium text-navy">{item.problem}</dd>
              </div>
              <div>
                <dt className="text-navy-muted">Решение</dt>
                <dd className="font-medium text-navy">{item.solution}</dd>
              </div>
              <div className="flex gap-4 pt-1">
                <div>
                  <dt className="text-xs text-navy-muted">Стоимость</dt>
                  <dd className="font-bold text-orange">{item.price}</dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-muted">Время</dt>
                  <dd className="font-semibold text-navy">{item.duration}</dd>
                </div>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
