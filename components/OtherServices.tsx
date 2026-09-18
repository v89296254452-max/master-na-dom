import Link from "next/link";
import { formatServiceInCity, type Page } from "@/lib/pages";
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
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading
          title={`Другие услуги в ${cityLabel}`}
          subtitle="Мастера по смежным направлениям в вашем городе"
        />
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((service) => (
            <li key={service.slug}>
              <Link
                href={`/${service.slug}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-[0.9375rem] text-ink transition-colors hover:border-accent hover:bg-accent-light"
              >
                <span className="font-medium">{formatServiceInCity(service)}</span>
                <span className="text-lg text-accent">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
