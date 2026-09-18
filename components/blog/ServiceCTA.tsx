import Link from "next/link";
import { getServiceCityLinks } from "@/lib/blog-posts";
import { phoneForService } from "@/lib/phones";

export default function ServiceCTA({
  service,
  serviceSlug,
}: {
  service: string;
  serviceSlug: string;
}) {
  const links = getServiceCityLinks(serviceSlug, 5);
  const serviceLabel = (service || "мастер").toLowerCase();
  const { display: PHONE, href: PHONE_HREF } = phoneForService(serviceSlug);

  return (
    <section className="bg-accent-light border border-border rounded-2xl p-6 sm:p-8 mt-10">
      <h2 className="text-xl font-bold text-ink">
        Нужен {serviceLabel} в вашем городе?
      </h2>
      <p className="mt-2 text-muted">
        Выезд мастера в день обращения. Диагностика и консультация — бесплатно.
      </p>

      {links.length > 0 && (
        <ul className="mt-5 grid sm:grid-cols-2 gap-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex items-center gap-2 text-accent font-medium hover:underline"
              >
                <span className="text-accent">→</span>
                {link.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={PHONE_HREF}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Оставить заявку
        </a>
        <a href={PHONE_HREF} className="font-semibold text-primary">
          {PHONE}
        </a>
      </div>
    </section>
  );
}
