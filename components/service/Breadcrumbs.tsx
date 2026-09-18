import Link from "next/link";

interface BreadcrumbsProps {
  service: string;
  cityPrepositional: string;
}

export default function Breadcrumbs({ service, cityPrepositional }: BreadcrumbsProps) {
  const currentLabel = `${service} в ${cityPrepositional || "городе"}`;

  return (
    <nav aria-label="Хлебные крошки" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
        <li>
          <Link href="/" className="transition-colors hover:text-accent">
            Главная
          </Link>
        </li>
        <li aria-hidden="true" className="text-faint">
          /
        </li>
        <li className="font-medium text-ink" aria-current="page">
          {currentLabel}
        </li>
      </ol>
    </nav>
  );
}
