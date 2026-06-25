import { TRUST_STATS, WHY_CHOOSE_US } from "@/lib/seo/constants";
import SectionHeading from "./SectionHeading";

const ICONS: Record<string, string> = {
  shield: "🛡",
  clock: "⏱",
  star: "★",
  wallet: "₽",
};

export default function TrustStatsBlock() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-navy p-6 sm:p-8 text-white">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white sm:text-2xl">ПроМастер в цифрах</h2>
          <p className="mt-2 text-white/70">Федеральная сеть мастеров по всей России</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TRUST_STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white/10 border border-white/15 p-5 text-center">
              <p className="text-3xl font-bold text-orange">{stat.value}</p>
              <p className="mt-1 text-sm text-white/80">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-gray-border p-6 sm:p-8">
        <SectionHeading title="Почему выбирают нас" />
        <div className="grid gap-4 sm:grid-cols-2">
          {WHY_CHOOSE_US.map((item) => (
            <div
              key={item.title}
              className="rounded-xl bg-gray-card border border-gray-border p-5"
            >
              <span className="text-2xl">{ICONS[item.icon]}</span>
              <h3 className="mt-2 font-semibold text-navy">{item.title}</h3>
              <p className="mt-1 text-sm text-navy-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
