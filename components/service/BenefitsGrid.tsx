import { EXTENDED_BENEFITS } from "@/lib/seo/constants";
import SectionHeading from "./SectionHeading";

export default function BenefitsGrid() {
  return (
    <section className="rounded-2xl bg-white border border-gray-border p-6 sm:p-8">
      <SectionHeading title="Наши преимущества" subtitle="Почему клиенты выбирают ПроМастер" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {EXTENDED_BENEFITS.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 rounded-xl bg-gray-card border border-gray-border p-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange font-bold text-sm">
              ✓
            </span>
            <span className="text-sm font-medium text-navy">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
