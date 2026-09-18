import type { FixStep } from "@/lib/problems-cluster";
import SectionHeading from "./SectionHeading";

interface HowWeFixBlockProps {
  title: string;
  steps: FixStep[];
}

export default function HowWeFixBlock({ title, steps }: HowWeFixBlockProps) {
  if (steps.length === 0) return null;

  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title={title} subtitle="Чёткий план работ — от заявки до гарантии" />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.step}
              className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-light text-lg font-bold text-accent">
                {step.step}
              </span>
              <h3 className="mt-3 font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
