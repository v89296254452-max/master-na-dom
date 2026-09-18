import type { PageVisual } from "@/lib/images";
import VisualImage from "./VisualImage";
import SectionHeading from "./SectionHeading";

interface ServiceGalleryProps {
  items: PageVisual[];
}

export default function ServiceGallery({ items }: ServiceGalleryProps) {
  if (items.length === 0) return null;

  return (
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title="Фото работ" subtitle="Мастера ПроМастер на выезде" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {items.map((visual, index) => (
            <div
              key={`${visual.meta.id}-${index}`}
              className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-surface"
            >
              <VisualImage
                visual={visual}
                variant="gallery"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
