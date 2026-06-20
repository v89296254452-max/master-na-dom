import SectionHeading from "./SectionHeading";

interface WhenNeedMasterProps {
  title: string;
  content: string;
}

export default function WhenNeedMaster({ title, content }: WhenNeedMasterProps) {
  if (!content?.trim()) return null;

  const paragraphs = content.split("\n\n").filter(Boolean);
  if (paragraphs.length === 0) return null;

  return (
    <section className="rounded-2xl bg-gray-card border border-gray-border p-6 sm:p-8">
      <SectionHeading title={title || "Когда нужен мастер"} />
      <div className="space-y-4 text-navy-light leading-relaxed">
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
