import type { PriceRow } from "@/lib/seo/prices";
import SectionHeading from "./SectionHeading";

interface ExtendedPriceTableProps {
  prices: PriceRow[];
}

export default function ExtendedPriceTable({ prices }: ExtendedPriceTableProps) {
  if (prices.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white border border-gray-border p-6 sm:p-8">
      <SectionHeading
        title="Цены на услуги"
        subtitle="Полный прайс-лист. Точная стоимость — после диагностики"
      />
      <div className="overflow-x-auto rounded-xl border border-gray-border">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="bg-gray-card">
              <th className="px-4 py-3 font-semibold text-navy sm:px-5">Услуга</th>
              <th className="px-4 py-3 font-semibold text-navy sm:px-5 text-right whitespace-nowrap">
                Стоимость
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-border">
            {prices.map((row) => (
              <tr key={row.name} className="hover:bg-gray-card/50">
                <td className="px-4 py-3.5 text-navy sm:px-5">{row.name}</td>
                <td className="px-4 py-3.5 font-semibold text-orange sm:px-5 text-right whitespace-nowrap">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-navy-muted">
        * Выезд и диагностика бесплатно при выполнении работ. Оплата после ремонта.
      </p>
    </section>
  );
}
