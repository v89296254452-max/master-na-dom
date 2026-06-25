import { WORKING_HOURS } from "@/lib/seo/constants";

export default function WorkingHoursBlock() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-navy to-navy-light p-6 sm:p-8 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{WORKING_HOURS.title}</h2>
          <p className="mt-2 text-3xl font-bold text-orange">{WORKING_HOURS.schedule}</p>
          <p className="mt-1 text-white/80">{WORKING_HOURS.note}</p>
        </div>
        <div className="rounded-xl bg-white/10 border border-white/20 px-6 py-4 text-center sm:text-right">
          <p className="text-lg font-semibold">{WORKING_HOURS.arrival}</p>
        </div>
      </div>
    </section>
  );
}
