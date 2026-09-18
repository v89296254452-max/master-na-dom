import Link from "next/link";
import type { Page } from "@/lib/pages";
import SectionHeading from "./service/SectionHeading";

interface PopularCitiesProps {
  service: string;
  pages: Page[];
}

export default function PopularCities({ service, pages }: PopularCitiesProps) {
  const items = (pages ?? []).filter((page) => page.slug && page.city);
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading
          title="Популярные города"
          subtitle={`${service} с выездом мастера на дом`}
        />
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/${page.slug}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-[0.9375rem] text-ink transition-colors hover:border-accent hover:bg-accent-light"
              >
                <span className="font-medium">{page.city}</span>
                <span className="text-lg text-accent">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
