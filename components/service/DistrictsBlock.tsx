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
    <section id="districts" className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
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
              className="rounded-full border border-accent/20 bg-accent-light px-3.5 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white"
            >
              {district.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
