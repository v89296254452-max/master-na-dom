import type { BrandItem } from "@/lib/seo/brands";
import SectionHeading from "./SectionHeading";

interface BrandsBlockProps {
  brands: BrandItem[];
}

export default function BrandsBlock({ brands }: BrandsBlockProps) {
  if (brands.length === 0) return null;

  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading
          title="Работаем с техникой"
          subtitle="Ремонт популярных марок бытовой техники"
        />
        <div className="flex flex-wrap gap-2">
          {brands.map((brand) => (
            <span
              key={brand.slug}
              className="rounded-full border border-border bg-bg px-4 py-2 text-sm font-semibold text-ink"
            >
              {brand.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
