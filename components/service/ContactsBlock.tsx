import { CONTACT_EMAIL, getMapEmbedUrl, getOfficeAddress } from "@/lib/offices";
import { WORKING_HOURS } from "@/lib/seo/constants";
import StaticMap from "./StaticMap";
import SectionHeading from "./SectionHeading";

interface ContactsBlockProps {
  city: string;
  phone: string;
  phoneHref: string;
}

export default function ContactsBlock({ city, phone, phoneHref }: ContactsBlockProps) {
  const address = getOfficeAddress(city);

  return (
    <section className="rounded-2xl border border-gray-border bg-white p-6 sm:p-8 shadow-sm">
      <SectionHeading title="Контакты в городе" subtitle={`ПроМастер — ${city || "ваш город"}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-border bg-gray-card p-5">
            <p className="text-lg font-bold text-navy">ПроМастер, {city}</p>
            {address ? (
              <p className="mt-2 text-navy">
                <span className="font-medium">Адрес:</span> {address}
              </p>
            ) : (
              <p className="mt-2 text-navy">Выездной сервис по городу</p>
            )}
            <p className="mt-2 text-navy">
              <span className="font-medium">Режим работы:</span> {WORKING_HOURS.schedule} — {WORKING_HOURS.note}
            </p>
            <p className="mt-2 text-navy">
              <span className="font-medium">Телефон:</span>{" "}
              <a href={phoneHref} className="font-semibold text-orange hover:underline">
                {phone}
              </a>
            </p>
          </div>

          <div className="rounded-xl border border-gray-border bg-gray-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-muted">E-mail</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-1 inline-block text-navy font-medium hover:text-orange transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

          <p className="text-sm text-navy-muted">
            {WORKING_HOURS.note}
          </p>
        </div>

        {address && (
          <StaticMap
            city={city}
            address={address}
            embedUrl={getMapEmbedUrl(city, address)}
          />
        )}
      </div>
    </section>
  );
}
