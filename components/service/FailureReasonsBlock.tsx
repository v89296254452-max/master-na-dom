import type { FailureBlock } from "@/lib/seo/failures";
import SectionHeading from "./SectionHeading";

interface FailureReasonsBlockProps {
  block: FailureBlock;
}

export default function FailureReasonsBlock({ block }: FailureReasonsBlockProps) {
  return (
    <section className="rounded-2xl bg-gray-card border border-gray-border p-6 sm:p-8">
      <SectionHeading title={block.title} subtitle="Типовые неисправности, которые устраняем на дому" />
      <ul className="grid gap-2 sm:grid-cols-2">
        {block.items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-xl bg-white border border-gray-border px-4 py-3 text-sm font-medium text-navy"
          >
            <span className="text-orange">•</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
