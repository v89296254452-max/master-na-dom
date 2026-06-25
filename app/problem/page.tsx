import type { Metadata } from "next";
import Link from "next/link";
import { getAllProblems, getProblemsByService } from "@/lib/problem";
import { MAIN_PROBLEM_SERVICES } from "@/lib/problem-generator";
import { getSiteUrl } from "@/lib/site";
import { BRAND } from "@/lib/service-templates";

export const revalidate = 86400;

const SERVICE_LABELS: Record<string, string> = {
  santehnik: "Сантехник",
  elektrik: "Электрик",
  "remont-stiralnyh-mashin": "Ремонт стиральных машин",
  "remont-holodilnikov": "Ремонт холодильников",
  kp: "Компьютерная помощь",
};

export const metadata: Metadata = {
  title: `Типовые проблемы — ${BRAND}`,
  description:
    "Справочник типовых неисправностей: сантехника, электрика, бытовая техника и компьютеры. Причины, самопроверка и когда вызывать мастера.",
  alternates: {
    canonical: `${getSiteUrl()}/problem`,
  },
  openGraph: {
    title: `Типовые проблемы — ${BRAND}`,
    description: "Частые поломки и неисправности с советами и ссылками на вызов мастера.",
    url: `${getSiteUrl()}/problem`,
    type: "website",
    locale: "ru_RU",
  },
};

export default function ProblemIndexPage() {
  const all = getAllProblems();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12 space-y-10">
      <nav className="text-sm text-navy-muted">
        <Link href="/" className="hover:text-orange">
          Главная
        </Link>
        <span className="mx-2">/</span>
        <span>Типовые проблемы</span>
      </nav>

      <header>
        <p className="text-sm font-medium text-orange">{BRAND}</p>
        <h1 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">Типовые проблемы</h1>
        <p className="mt-3 text-lg text-navy-muted">
          Тематический справочник неисправностей: причины, безопасная самопроверка и когда вызывать
          мастера. Заявки принимаем 24/7.
        </p>
      </header>

      {MAIN_PROBLEM_SERVICES.map((serviceSlug) => {
        const items = getProblemsByService(serviceSlug, 24);
        if (items.length === 0) return null;

        return (
          <section key={serviceSlug} className="rounded-2xl border border-gray-border bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold text-navy">{SERVICE_LABELS[serviceSlug] ?? serviceSlug}</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {items.map((problem) => (
                <li key={problem.slug}>
                  <Link
                    href={`/problem/${problem.slug}`}
                    className="text-sm text-navy-muted hover:text-orange transition-colors"
                  >
                    {problem.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="text-sm text-navy-muted">Всего материалов: {all.length}</p>
    </main>
  );
}
