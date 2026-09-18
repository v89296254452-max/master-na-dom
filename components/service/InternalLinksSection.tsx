import Link from "next/link";
import type { PageInternalLinks } from "@/lib/seo/internal-links";
import SectionHeading from "./SectionHeading";

interface InternalLinksSectionProps {
  links: PageInternalLinks;
}

function LinkGroup({ title, items }: { title: string; items: { title: string; href: string }[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <h3 className="font-semibold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.href + item.title}>
            <Link href={item.href} className="line-clamp-2 text-[0.9rem] text-accent transition-colors hover:underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InternalLinksSection({ links }: InternalLinksSectionProps) {
  const hasAny =
    links.otherServices.length ||
    links.nearbyCities.length ||
    links.popularServices.length ||
    links.blogArticles.length ||
    links.problemArticles.length ||
    links.brandArticles.length ||
    links.popularRequests.length;

  if (!hasAny) return null;

  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title="Полезные ссылки" subtitle="Услуги, города, статьи и неисправности" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LinkGroup title="Другие услуги в городе" items={links.otherServices} />
          <LinkGroup title="Эта услуга в других городах" items={links.nearbyCities} />
          <LinkGroup title="Популярные услуги" items={links.popularServices} />
          <LinkGroup title="Популярные статьи" items={links.blogArticles} />
          <LinkGroup title="Популярные неисправности" items={links.problemArticles} />
          <LinkGroup title="Популярные бренды" items={links.brandArticles} />
          <LinkGroup title="Популярные запросы" items={links.popularRequests} />
        </div>
      </div>
    </section>
  );
}
