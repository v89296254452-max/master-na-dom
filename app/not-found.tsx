import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-navy">404 — Страница не найдена</h1>
      <p className="mt-4 text-navy-light">Запрашиваемая страница не существует.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-orange px-6 py-3 font-semibold text-white hover:bg-orange-dark"
      >
        На главную
      </Link>
    </main>
  );
}
