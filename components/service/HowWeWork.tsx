import { HOW_WE_WORK } from "@/lib/service-ui";
import SectionHeading from "./SectionHeading";

export default function HowWeWork() {
  return (
    <section className="rounded-2xl bg-white border border-gray-border p-6 sm:p-8">
      <SectionHeading title="Как мы работаем" subtitle="Простой процесс от заявки до результата" />
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HOW_WE_WORK.map((item) => (
          <li
            key={item.step}
            className="relative rounded-xl bg-gray-card p-5 border border-gray-border"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange text-sm font-bold text-white">
              {item.step}
            </span>
            <h3 className="mt-3 font-semibold text-navy">{item.title}</h3>
            <p className="mt-1.5 text-sm text-navy-muted">{item.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
