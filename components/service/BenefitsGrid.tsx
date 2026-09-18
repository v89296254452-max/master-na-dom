import { EXTENDED_BENEFITS } from "@/lib/seo/constants";
import SectionHeading from "./SectionHeading";

export default function BenefitsGrid() {
  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title="Наши преимущества" subtitle="Почему клиенты выбирают ПроМастер" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXTENDED_BENEFITS.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-border bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-accent">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <p className="mt-4 font-semibold text-ink">{item}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
