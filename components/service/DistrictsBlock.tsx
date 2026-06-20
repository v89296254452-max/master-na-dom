import SectionHeading from "./SectionHeading";

interface DistrictsBlockProps {
  cityPrepositional: string;
  districts: string[];
}

export default function DistrictsBlock({ cityPrepositional, districts }: DistrictsBlockProps) {
  const items = (districts ?? []).filter(Boolean);
  if (items.length === 0) return null;

  const cityLabel = cityPrepositional || "городе";

  return (
    <section className="rounded-2xl bg-gray-card border border-gray-border p-6 sm:p-8">
      <SectionHeading
        title={`Работаем во всех районах ${cityLabel}`}
        subtitle="Мастер выезжает в любую точку города"
      />
      <div className="flex flex-wrap gap-2">
        {items.map((district) => (
          <span
            key={district}
            className="rounded-full bg-white border border-gray-border px-4 py-2 text-sm font-medium text-navy"
          >
            {district}
          </span>
        ))}
      </div>
    </section>
  );
}
