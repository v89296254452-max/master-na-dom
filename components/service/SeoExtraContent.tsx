import type { SeoBlock } from "@/lib/seo-content";

interface SeoExtraContentProps {
  blocks: SeoBlock[];
}

export default function SeoExtraContent({ blocks }: SeoExtraContentProps) {
  const items = (blocks ?? []).filter((block) => block?.title || block?.paragraphs?.length);
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-border bg-gray-card/50 p-6 sm:p-8">
      <div className="space-y-8">
        {items.map((block, i) => (
          <article key={i}>
            <h2 className="mb-3 text-lg font-semibold text-navy">{block.title}</h2>
            {(block.paragraphs ?? []).map((paragraph, j) => (
              <p key={j} className="mb-3 text-sm text-navy-muted leading-relaxed last:mb-0">
                {paragraph}
              </p>
            ))}
            {block.listItems?.length ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-navy-muted">
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
