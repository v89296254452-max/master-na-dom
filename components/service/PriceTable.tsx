import { parsePriceRow } from "@/lib/service-ui";
import SectionHeading from "./SectionHeading";

interface PriceTableProps {
  prices: string[];
}

export default function PriceTable({ prices }: PriceTableProps) {
  const rows = (prices ?? []).filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white border border-gray-border p-6 sm:p-8">
      <SectionHeading
        title="Цены на услуги"
        subtitle="Точная стоимость определяется после осмотра"
      />
      <div className="overflow-hidden rounded-xl border border-gray-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-card">
              <th className="px-4 py-3 font-semibold text-navy sm:px-5">Услуга</th>
              <th className="px-4 py-3 font-semibold text-navy sm:px-5 text-right whitespace-nowrap">
                Стоимость
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-border">
            {rows.map((price, i) => {
              const row = parsePriceRow(price);
              if (!row.name && !row.value) return null;
              return (
                <tr key={i} className="hover:bg-gray-card/50">
                  <td className="px-4 py-3.5 text-navy sm:px-5">{row.name}</td>
                  <td className="px-4 py-3.5 font-semibold text-orange sm:px-5 text-right whitespace-nowrap">
                    {row.value || row.name}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-navy-muted">
        * Выезд и диагностика бесплатно при выполнении работ
      </p>
    </section>
  );
}
