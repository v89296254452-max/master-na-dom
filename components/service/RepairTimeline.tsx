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

function StepCircle({ step }: { step: string }) {
  return (
    <span
      className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a00] to-[#ff9f43] text-base font-bold text-white shadow-md shadow-orange/25 transition-transform duration-300 group-hover:scale-110 sm:size-12"
      aria-hidden
    >
      {step}
    </span>
  );
}

function StepCardBody({ item }: { item: RepairTimelineStep }) {
  return (
    <>
      <h3 className="text-sm font-semibold leading-snug text-navy sm:text-base">{item.title}</h3>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-navy-muted sm:text-sm">{item.desc}</p>
    </>
  );
}

export default function RepairTimeline({
  title = "Как проходит ремонт",
  subtitle = "Всего 7 простых шагов — от обращения до получения гарантии.",
  steps,
}: RepairTimelineProps) {
  if (steps.length === 0) return null;

  return (
    <section className="rounded-3xl border border-gray-border bg-gray-card/40 p-6 sm:p-8">
      <header className="mb-8 text-center sm:mb-10">
        <h2 className="text-xl font-bold text-navy sm:text-2xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-navy-muted sm:text-base">{subtitle}</p>
      </header>

      <ol className="mx-auto flex max-w-2xl flex-col gap-0">
        {steps.map((item, index) => (
          <li key={item.step} className="group relative flex gap-4 pb-6 last:pb-0 sm:gap-5 sm:pb-7">
            <div className="flex flex-col items-center">
              <StepCircle step={item.step} />
              {index < steps.length - 1 && (
                <span className="mt-2 min-h-6 w-px flex-1 bg-orange/35 sm:min-h-8" aria-hidden />
              )}
            </div>
            <article className="mb-1 min-w-0 flex-1 rounded-[18px] border border-gray-border bg-white p-4 shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.01] group-hover:shadow-md sm:p-5">
              <StepCardBody item={item} />
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
