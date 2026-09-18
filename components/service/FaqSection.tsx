import SectionHeading from "./SectionHeading";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  faqs: FaqItem[];
}

export default function FaqSection({ faqs }: FaqSectionProps) {
  const items = (faqs ?? []).filter((faq) => faq.question?.trim() && faq.answer?.trim());
  if (items.length === 0) return null;

  return (
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[720px]">
        <SectionHeading title="Частые вопросы" />
        <div>
          {items.map((faq, i) => (
            <details key={i} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-[1.125rem] text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {faq.question}
                <span className="shrink-0 text-xl font-light leading-none text-accent transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="pb-4 text-[0.9375rem] leading-relaxed text-muted">{faq.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
