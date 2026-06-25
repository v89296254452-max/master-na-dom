import type { Metadata } from "next";
import Link from "next/link";
import { getAllBlogArticles } from "@/lib/blog";
import { BRAND } from "@/lib/service-templates";
import { getSiteUrl } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Блог | ${BRAND}`,
  description: "Статьи о ремонте техники, сантехнике и электрике — советы мастеров ПроМастер",
  alternates: { canonical: `${getSiteUrl()}/blog` },
};

export default function BlogIndexPage() {
  const articles = getAllBlogArticles();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <header>
        <nav className="text-sm text-navy-muted">
          <Link href="/" className="hover:text-orange">
            Главная
          </Link>
          <span className="mx-2">/</span>
          <span>Блог</span>
        </nav>
        <h1 className="mt-4 text-3xl font-bold text-navy">Блог {BRAND}</h1>
        <p className="mt-2 text-navy-muted">
          Поломки, советы по эксплуатации и когда вызывать мастера
        </p>
      </header>

      <p className="text-sm text-navy-muted">{articles.length} статей</p>

      <ul className="divide-y divide-gray-border rounded-xl border border-gray-border">
        {articles.slice(0, 150).map((article) => (
          <li key={article.slug}>
            <Link
              href={`/blog/${article.slug}`}
              className="block px-5 py-4 hover:bg-gray-light transition-colors"
            >
              <p className="text-xs font-medium text-orange">{article.service} · {article.city}</p>
              <p className="mt-1 font-semibold text-navy">{article.title}</p>
              <p className="mt-1 text-sm text-navy-muted line-clamp-2">{article.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
