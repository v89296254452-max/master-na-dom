import type { BrandItem } from "@/lib/seo/brands";
import SectionHeading from "./SectionHeading";

interface BrandsBlockProps {
  brands: BrandItem[];
}

export default function BrandsBlock({ brands }: BrandsBlockProps) {
  if (brands.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-border bg-white p-6 sm:p-8 shadow-sm">
      <SectionHeading
        title="Работаем с техникой"
        subtitle="Ремонт популярных марок бытовой техники"
      />
      <div className="flex flex-wrap gap-2">
        {brands.map((brand) => (
          <span
            key={brand.slug}
            className="rounded-full border border-gray-border bg-gray-card px-4 py-2.5 text-sm font-semibold text-navy"
          >
            {brand.name}
          </span>
        ))}
      </div>
    </section>
  );
}
