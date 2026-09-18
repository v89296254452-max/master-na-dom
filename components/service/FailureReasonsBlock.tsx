import type { FailureBlock } from "@/lib/seo/failures";
import SectionHeading from "./SectionHeading";

interface FailureReasonsBlockProps {
  block: FailureBlock;
}

export default function FailureReasonsBlock({ block }: FailureReasonsBlockProps) {
  return (
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title={block.title} subtitle="Типовые неисправности, которые устраняем на дому" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-[0.9375rem] text-ink"
            >
              <span className="h-2 w-2 shrink-0 rounded-[2px] bg-accent" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
