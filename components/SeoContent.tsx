import type { SeoBlock } from "@/lib/seo-content";

interface SeoContentProps {
  blocks: SeoBlock[];
}

export default function SeoContent({ blocks }: SeoContentProps) {
  return (
    <section className="mb-10 space-y-8">
      {blocks.map((block, i) => (
        <article key={i} className="rounded-xl border border-gray-border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-navy sm:text-2xl">
            {block.title}
          </h2>
          {block.paragraphs.map((paragraph, j) => (
            <p key={j} className="mb-3 text-navy-light leading-relaxed last:mb-0">
              {paragraph}
            </p>
          ))}
          {block.listItems && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-navy-light">
              {block.listItems.map((item, k) => (
                <li key={k}>{item}</li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </section>
  );
}
