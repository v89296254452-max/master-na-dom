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
    <section id={id} className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title={title} />
        {paragraphs.length > 0 && (
          <div className="mb-4 space-y-3 text-[0.9375rem] leading-7 text-ink">
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
                className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-[0.9375rem] text-ink"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px] bg-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
