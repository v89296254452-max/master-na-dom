import type { PriceRow } from "@/lib/seo/prices";
import SectionHeading from "./SectionHeading";

interface ExtendedPriceTableProps {
  prices: PriceRow[];
}

export default function ExtendedPriceTable({ prices }: ExtendedPriceTableProps) {
  if (prices.length === 0) return null;

  return (
    <section className="bg-surface px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading
          title="Цены на услуги"
          subtitle="Полный прайс-лист. Точная стоимость — после диагностики"
        />
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="px-5 py-3.5 font-semibold">Услуга</th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-right font-semibold">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody>
                {prices.map((row, i) => {
                  const value = row.value.toLowerCase();
                  const isFree = value.includes("беспл") || value.includes("без допл");
                  return (
                    <tr
                      key={row.name}
                      className={`border-b border-border transition-colors last:border-0 hover:bg-accent-light ${
                        i % 2 === 0 ? "bg-surface" : "bg-bg"
                      }`}
                    >
                      <td className="px-5 py-3.5 text-ink">{row.name}</td>
                      <td
                        className={`whitespace-nowrap px-5 py-3.5 text-right font-semibold ${
                          isFree ? "text-success" : "text-accent"
                        }`}
                      >
                        {row.value}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-4 text-xs italic text-faint">
          * Выезд и диагностика бесплатно при выполнении работ. Оплата после ремонта.
        </p>
      </div>
    </section>
  );
}
