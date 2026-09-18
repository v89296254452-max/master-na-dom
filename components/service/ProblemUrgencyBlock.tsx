import type { UrgencyReason } from "@/lib/problems-cluster";
import SectionHeading from "./SectionHeading";

interface ProblemUrgencyBlockProps {
  reasons: UrgencyReason[];
}

export default function ProblemUrgencyBlock({ reasons }: ProblemUrgencyBlockProps) {
  if (reasons.length === 0) return null;

  return (
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading
          title="Почему важно не откладывать"
          subtitle="Чем раньше вызвать мастера, тем дешевле и проще решить проблему"
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-xl border border-border border-l-[3px] border-l-accent bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-light text-accent">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </span>
              <h3 className="mt-3 font-semibold text-ink">{reason.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{reason.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
