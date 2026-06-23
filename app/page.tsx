import Link from "next/link";
import { getAllPages } from "@/lib/pages";

export default function HomePage() {
  const pages = getAllPages();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">
          ПроМастер — бытовые услуги
        </h1>
        <p className="mt-3 text-lg text-navy-light">
          Вызов мастера на дом. Сантехник, электрик, ремонт техники.
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-navy">Наши услуги</h2>
        <ul className="divide-y divide-gray-border rounded-xl border border-gray-border">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/${page.slug}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-light"
              >
                <span className="font-medium text-navy">
                  {page.service} в {page.cityPrepositional}
                </span>
                <span className="text-orange">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
