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
    <section className="rounded-2xl bg-white border border-gray-border p-6 sm:p-8">
      <SectionHeading title="Частые вопросы" />
      <div className="space-y-3">
        {items.map((faq, i) => (
          <details
            key={i}
            className="group rounded-xl border border-gray-border bg-gray-card open:bg-white"
          >
            <summary className="cursor-pointer px-5 py-4 font-medium text-navy select-none list-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                {faq.question}
                <span className="shrink-0 text-orange transition-transform group-open:rotate-45 text-xl leading-none">
                  +
                </span>
              </span>
            </summary>
            <div className="border-t border-gray-border px-5 py-4 text-sm text-navy-muted leading-relaxed">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
