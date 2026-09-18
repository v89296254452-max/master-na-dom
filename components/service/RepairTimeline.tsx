import SectionHeading from "./SectionHeading";

export interface RepairTimelineStep {
  step: string;
  title: string;
  desc: string;
}

interface RepairTimelineProps {
  title?: string;
  subtitle?: string;
  steps: RepairTimelineStep[];
}

function Circle({ step, size }: { step: string; size: string }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-accent`}
      aria-hidden
    >
      {step}
    </span>
  );
}

export default function RepairTimeline({
  title = "Как проходит ремонт",
  subtitle = "Всего 7 простых шагов — от обращения до получения гарантии.",
  steps,
}: RepairTimelineProps) {
  if (steps.length === 0) return null;

  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title={title} subtitle={subtitle} />

        {/* Desktop: horizontal timeline */}
        <ol
          className="hidden md:grid"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((item, index) => (
            <li key={item.step} className="relative flex flex-col items-center text-center">
              <div className="flex w-full items-center justify-center">
                {index > 0 && <span className="h-px flex-1 bg-border" aria-hidden />}
                <Circle step={item.step} size="h-9 w-9" />
                {index < steps.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
              </div>
              <h3 className="mt-3 px-1 text-[0.8rem] font-semibold leading-snug text-ink">{item.title}</h3>
              <p className="mt-1 px-1 text-xs leading-relaxed text-muted">{item.desc}</p>
            </li>
          ))}
        </ol>

        {/* Mobile: vertical timeline */}
        <ol className="flex flex-col md:hidden">
          {steps.map((item, index) => (
            <li key={item.step} className="flex gap-4">
              <div className="flex flex-col items-center">
                <Circle step={item.step} size="h-8 w-8" />
                {index < steps.length - 1 && (
                  <span className="my-1 w-px flex-1 bg-border" aria-hidden />
                )}
              </div>
              <div className={index < steps.length - 1 ? "pb-6" : ""}>
                <h3 className="text-base font-semibold leading-snug text-ink">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
