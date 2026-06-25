import Link from "next/link";
import type { PageInternalLinks } from "@/lib/seo/internal-links";
import SectionHeading from "./SectionHeading";

interface InternalLinksSectionProps {
  links: PageInternalLinks;
}

function LinkGroup({ title, items }: { title: string; items: { title: string; href: string }[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-border bg-white p-5">
      <h3 className="font-semibold text-navy">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.href + item.title}>
            <Link href={item.href} className="text-sm text-navy-muted hover:text-orange transition-colors line-clamp-2">
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
    <section className="rounded-2xl border border-gray-border bg-gray-card p-6 sm:p-8">
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
    </section>
  );
}
