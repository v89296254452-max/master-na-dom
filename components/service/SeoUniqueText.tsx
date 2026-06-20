import SectionHeading from "./SectionHeading";

interface SeoUniqueTextProps {
  title: string;
  paragraphs: string[];
}

export default function SeoUniqueText({ title, paragraphs }: SeoUniqueTextProps) {
  const items = (paragraphs ?? []).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white border border-gray-border p-6 sm:p-8">
      <SectionHeading title={title} />
      <div className="space-y-4 text-navy-light leading-relaxed">
        {items.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
