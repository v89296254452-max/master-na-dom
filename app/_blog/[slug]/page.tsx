import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAllBlogArticles,
  getArticleParagraphs,
  getBlogArticleBySlug,
  getCommercialLinksForArticle,
  getSimilarArticles,
} from "@/lib/blog";
import { getSiteUrl } from "@/lib/site";
import { BRAND } from "@/lib/service-templates";
import { getPhone } from "@/lib/pages";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400;

export function generateStaticParams() {
  return getAllBlogArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getBlogArticleBySlug(slug);
  if (!article) return { title: "Статья не найдена" };

  const siteUrl = getSiteUrl();
  return {
    title: `${article.title} | ${BRAND}`,
    description: article.description,
    alternates: { canonical: `${siteUrl}/blog/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `${siteUrl}/blog/${article.slug}`,
      type: "article",
      locale: "ru_RU",
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getBlogArticleBySlug(slug);
  if (!article) notFound();

  const paragraphs = getArticleParagraphs(article);
  const similarArticles = getSimilarArticles(article, 5);
  const commercialLinks = getCommercialLinksForArticle(article, 5);
  const phone = getPhone(article.phone);
  const phoneHref = `tel:${phone.replace(/\D/g, "")}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <nav className="text-sm text-navy-muted">
        <Link href="/" className="hover:text-orange">
          Главная
        </Link>
        <span className="mx-2">/</span>
        <Link href="/blog" className="hover:text-orange">
          Блог
        </Link>
      </nav>

      <header>
        <p className="text-sm font-medium text-orange">
          {article.service} · {article.city}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-navy">{article.title}</h1>
        <p className="mt-3 text-lg text-navy-muted">{article.description}</p>
        <p className="mt-2 text-sm text-navy-muted">{article.createdAt}</p>
      </header>

      <article className="prose prose-navy max-w-none space-y-4 text-navy-muted leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      <section className="rounded-2xl border border-orange/30 bg-orange/5 p-6">
        <h2 className="text-xl font-bold text-navy">Нужен мастер?</h2>
        <p className="mt-3 text-navy-muted">
          Если нужен мастер в {article.cityPrepositional}, оставьте заявку на странице услуги:{" "}
          <Link href={article.targetUrl} className="font-semibold text-orange hover:underline">
            {article.targetUrl}
          </Link>
        </p>
        <p className="mt-3">
          Телефон:{" "}
          <a href={phoneHref} className="text-xl font-bold text-navy hover:text-orange">
            {phone}
          </a>
        </p>
      </section>

      {similarArticles.length > 0 && (
        <section className="rounded-2xl border border-gray-border bg-gray-card p-6">
          <h2 className="text-xl font-bold text-navy">Похожие статьи</h2>
          <ul className="mt-4 space-y-2">
            {similarArticles.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-orange hover:underline font-medium">
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {commercialLinks.length > 0 && (
        <section className="rounded-2xl border border-gray-border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-navy">Услуги в {article.cityPrepositional}</h2>
          <ul className="mt-4 space-y-2">
            {commercialLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-orange hover:underline font-medium">
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
