interface StaticMapProps {
  city: string;
  address: string;
  embedUrl: string;
}

export default function StaticMap({ city, address, embedUrl }: StaticMapProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-border bg-gray-card">
      <div className="border-b border-gray-border px-4 py-3">
        <p className="text-sm font-semibold text-navy">{city}</p>
        <p className="text-xs text-navy-muted">{address}</p>
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
