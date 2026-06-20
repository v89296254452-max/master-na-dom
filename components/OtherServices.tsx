import Link from "next/link";
import type { Page } from "@/lib/pages";
import SectionHeading from "./service/SectionHeading";

interface OtherServicesProps {
  cityPrepositional: string;
  services: Page[];
}

export default function OtherServices({ cityPrepositional, services }: OtherServicesProps) {
  const items = (services ?? []).filter((service) => service.slug && service.service);
  if (items.length === 0) {
    return null;
  }

  const cityLabel = cityPrepositional || "городе";

  return (
    <section className="rounded-2xl bg-gray-card border border-gray-border p-6 sm:p-8">
      <SectionHeading
        title={`Другие услуги в ${cityLabel}`}
        subtitle="Мастера по смежным направлениям в вашем городе"
      />
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((service) => (
          <li key={service.slug}>
            <Link
              href={`/${service.slug}`}
              className="flex items-center justify-between rounded-xl bg-white border border-gray-border px-4 py-3.5 transition-colors hover:border-orange/30 hover:shadow-sm"
            >
              <span className="text-sm font-medium text-navy">
                {service.service}
              </span>
              <span className="text-orange text-lg">&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
