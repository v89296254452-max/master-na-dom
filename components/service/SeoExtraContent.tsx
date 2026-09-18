import type { SeoBlock } from "@/lib/seo-content";

interface SeoExtraContentProps {
  blocks: SeoBlock[];
}

export default function SeoExtraContent({ blocks }: SeoExtraContentProps) {
  const items = (blocks ?? []).filter((block) => block?.title || block?.paragraphs?.length);
  if (items.length === 0) return null;

  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px] space-y-8">
        {items.map((block, i) => (
          <article key={i}>
            <h2 className="mb-3 text-lg font-semibold text-ink">{block.title}</h2>
            {(block.paragraphs ?? []).map((paragraph, j) => (
              <p key={j} className="mb-3 text-[0.9375rem] leading-relaxed text-muted last:mb-0">
                {paragraph}
              </p>
            ))}
            {block.listItems?.length ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[0.9375rem] text-muted">
                {block.listItems.map((item, k) => (
                  <li key={k}>{item}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
