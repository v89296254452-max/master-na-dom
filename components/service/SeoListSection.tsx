import SectionHeading from "./SectionHeading";

interface SeoListSectionProps {
  id?: string;
  title: string;
  intro?: string[];
  items?: string[];
}

export default function SeoListSection({ id, title, intro, items }: SeoListSectionProps) {
  const paragraphs = (intro ?? []).filter(Boolean);
  const listItems = (items ?? []).filter(Boolean);

  if (paragraphs.length === 0 && listItems.length === 0) return null;

  return (
    <section id={id} className="rounded-2xl bg-gray-card border border-gray-border p-6 sm:p-8 shadow-sm">
      <SectionHeading title={title} />
      {paragraphs.length > 0 && (
        <div className="mb-4 space-y-3 text-navy-light leading-relaxed">
          {paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      )}
      {listItems.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {listItems.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-xl bg-white border border-gray-border px-4 py-3 text-sm text-navy"
            >
              <span className="mt-0.5 shrink-0 text-orange">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
