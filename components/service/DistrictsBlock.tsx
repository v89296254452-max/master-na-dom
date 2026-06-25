import Link from "next/link";
import type { DistrictLink } from "@/lib/seo/districts";
import SectionHeading from "./SectionHeading";

interface DistrictsBlockProps {
  cityPrepositional: string;
  districts: DistrictLink[];
}

export default function DistrictsBlock({ cityPrepositional, districts }: DistrictsBlockProps) {
  const items = (districts ?? []).filter((d) => d.name);
  if (items.length === 0) return null;

  const cityLabel = cityPrepositional || "городе";

  return (
    <section id="districts" className="rounded-2xl bg-gray-card border border-gray-border p-6 sm:p-8">
      <SectionHeading
        title={`Работаем во всех районах ${cityLabel}`}
        subtitle="Мастер выезжает в любую точку города"
      />
      <div className="flex flex-wrap gap-2">
        {items.map((district) => (
          <Link
            key={district.name}
            id={district.href?.includes("#") ? district.href.split("#")[1] : undefined}
            href={district.href}
            className="rounded-full bg-white border border-gray-border px-4 py-2 text-sm font-medium text-navy hover:border-orange hover:text-orange transition-colors"
          >
            {district.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
