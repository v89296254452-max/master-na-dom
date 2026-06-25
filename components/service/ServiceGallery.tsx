import type { PageVisual } from "@/lib/images";
import VisualImage from "./VisualImage";
import SectionHeading from "./SectionHeading";

interface ServiceGalleryProps {
  items: PageVisual[];
}

export default function ServiceGallery({ items }: ServiceGalleryProps) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-3xl border border-gray-border bg-white p-6 sm:p-8 shadow-md">
      <SectionHeading title="Фото работ" subtitle="Мастера ПроМастер на выезде" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {items.map((visual, index) => (
          <div
            key={`${visual.meta.id}-${index}`}
            className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-gray-border bg-gray-card shadow-sm"
          >
            <VisualImage
              visual={visual}
              variant="gallery"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
