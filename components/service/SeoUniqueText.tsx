import SectionHeading from "./SectionHeading";

interface SeoUniqueTextProps {
  title: string;
  paragraphs: string[];
}

export default function SeoUniqueText({ title, paragraphs }: SeoUniqueTextProps) {
  const items = (paragraphs ?? []).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-8">
          <SectionHeading title={title} />
          <div className="space-y-4 text-[0.9375rem] leading-7 text-ink">
            {items.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
