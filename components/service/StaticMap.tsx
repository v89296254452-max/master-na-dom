interface StaticMapProps {
  city: string;
  address: string;
  embedUrl: string;
}

export default function StaticMap({ city, address, embedUrl }: StaticMapProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-ink">{city}</p>
        <p className="text-xs text-muted">{address}</p>
      </div>
      <div className="relative aspect-[2/1] w-full">
        <iframe
          src={embedUrl}
          title={`Карта — ${address}, ${city}`}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
