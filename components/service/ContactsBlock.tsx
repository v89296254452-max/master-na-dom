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
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading title="Контакты в городе" subtitle={`ПроМастер — ${city || "ваш город"}`} />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <h3 className="text-lg font-bold text-ink">ПроМастер, {city}</h3>
              {address ? (
                <p className="mt-2 flex gap-2 text-sm">
                  <span className="font-semibold text-ink">Адрес:</span>
                  <span className="text-muted">{address}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">Выездной сервис по городу</p>
              )}
              <p className="mt-2 flex gap-2 text-sm">
                <span className="font-semibold text-ink">Режим работы:</span>
                <span className="text-muted">{WORKING_HOURS.schedule} — {WORKING_HOURS.note}</span>
              </p>
              <p className="mt-2 flex gap-2 text-sm">
                <span className="font-semibold text-ink">Телефон:</span>
                <a href={phoneHref} className="font-semibold text-accent hover:underline">
                  {phone}
                </a>
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">E-mail</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-1 inline-block font-medium text-accent transition-colors hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </div>

            <p className="text-sm text-muted">{WORKING_HOURS.note}</p>
          </div>

          {address && (
            <StaticMap
              city={city}
              address={address}
              embedUrl={getMapEmbedUrl(city, address)}
            />
          )}
        </div>
      </div>
    </section>
  );
}
