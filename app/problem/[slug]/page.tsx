import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProblemPageContent from "@/components/problem/ProblemPageContent";
import JsonLdScripts from "@/components/service/JsonLdScripts";
import { getProblemBySlug } from "@/lib/problem";
import { buildProblemArticleJsonLd, buildProblemBreadcrumbJsonLd } from "@/lib/seo/problem-schema";
import { getSiteUrl } from "@/lib/site";
import { BRAND } from "@/lib/service-templates";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const problem = getProblemBySlug(slug);
  if (!problem) return { title: "Страница не найдена" };

  const siteUrl = getSiteUrl();
  const pageTitle = `${problem.title} | ${BRAND}`;

  return {
    title: pageTitle,
    description: problem.description,
    alternates: {
      canonical: `${siteUrl}/problem/${problem.slug}`,
    },
    openGraph: {
      title: problem.title,
      description: problem.description,
      url: `${siteUrl}/problem/${problem.slug}`,
      type: "article",
      locale: "ru_RU",
      siteName: BRAND,
    },
    twitter: {
      card: "summary",
      title: problem.title,
      description: problem.description,
    },
  };
}

export default async function ProblemDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const problem = getProblemBySlug(slug);
  if (!problem) notFound();

  const jsonLd = [
    buildProblemBreadcrumbJsonLd(problem),
    buildProblemArticleJsonLd(problem),
  ];

  return (
    <>
      <JsonLdScripts schemas={jsonLd} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <nav className="text-sm text-navy-muted mb-8">
          <Link href="/" className="hover:text-orange">
            Главная
          </Link>
          <span className="mx-2">/</span>
          <Link href="/problem" className="hover:text-orange">
            Типовые проблемы
          </Link>
          <span className="mx-2">/</span>
          <span className="line-clamp-1">{problem.problemTitle}</span>
        </nav>

        <ProblemPageContent problem={problem} />
      </main>
    </>
  );
}
