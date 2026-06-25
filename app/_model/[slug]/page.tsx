import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getModelPage,
  getCommercialLinksForInfoPage,
} from "@/lib/info-pages/definitions";
import { getSiteUrl } from "@/lib/site";
import { BRAND } from "@/lib/service-templates";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getModelPage(slug);
  if (!page) return { title: "Страница не найдена" };

  const siteUrl = getSiteUrl();
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `${siteUrl}/model/${page.slug}` },
  };
}

export default async function ModelPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getModelPage(slug);
  if (!page) notFound();

  const links = getCommercialLinksForInfoPage(page);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <nav className="text-sm text-navy-muted">
        <Link href="/" className="hover:text-orange">Главная</Link>
        <span className="mx-2">/</span>
        <span>{page.h1}</span>
      </nav>
      <header>
        <p className="text-sm font-medium text-orange">{BRAND}</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">{page.h1}</h1>
        <p className="mt-3 text-lg text-navy-muted">{page.description}</p>
      </header>
      <article className="space-y-4 text-navy-muted">
        {page.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      {links.length > 0 && (
        <section className="rounded-2xl border border-gray-border bg-gray-card p-6">
          <h2 className="text-xl font-bold text-navy">Вызвать мастера</h2>
          <ul className="mt-4 space-y-2">
            {links.map((link) => (
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
