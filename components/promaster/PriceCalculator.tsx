"use client";

import { useMemo, useState } from "react";
import { CALC_SERVICES, getCalcService } from "@/lib/offer-catalog";

interface PriceCalculatorProps {
  defaultService?: string;
}

export default function PriceCalculator({ defaultService }: PriceCalculatorProps) {
  const services = CALC_SERVICES.map((s) => s.name);
  const initial = defaultService && CALC_SERVICES.some((s) => s.name === defaultService)
    ? defaultService
    : services[0];
  const [svc, setSvc] = useState(initial);
  const data = getCalcService(svc);
  const probs = useMemo(() => Object.keys(data.probs), [data]);
  const [prob, setProb] = useState(Object.keys(getCalcService(initial).probs)[0]);
  const [urg, setUrg] = useState(1);

  const activeProb = data.probs[prob] ? prob : probs[0];
  const range = data.probs[activeProb] || data.base;
  const from = Math.round((range[0] * urg) / 50) * 50;
  const to = Math.round((range[1] * urg) / 50) * 50;
  const mid = Math.round((from + to) / 2 / 50) * 50;
  const diy = data.diy?.[activeProb];

  return (
    <div className="calc rv">
      <div className="calc-controls">
        <div className="field">
          <label>Услуга</label>
          <select
            value={data.name}
            onChange={(e) => {
              setSvc(e.target.value);
              setProb(Object.keys(getCalcService(e.target.value).probs)[0]);
            }}
          >
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Что случилось</label>
          <select value={activeProb} onChange={(e) => setProb(e.target.value)}>
            {probs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Срочность</label>
          <select value={urg} onChange={(e) => setUrg(+e.target.value)}>
            <option value={1}>В ближайшие дни</option>
            <option value={1.25}>Сегодня</option>
            <option value={1.5}>Срочно, сейчас (24/7)</option>
          </select>
        </div>
        <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--faint)", lineHeight: 1.5 }}>
          Цена зависит от причины поломки, нужных запчастей и срочности. Точную стоимость мастер
          назовёт после бесплатной диагностики.
        </p>
      </div>
      <div className="calc-result">
        <div className="cr-top">Ориентировочная стоимость</div>
        <div className="cr-price">
          <span>{from.toLocaleString("ru")}</span>
          <span className="cr-dash">–</span>
          <span>{to.toLocaleString("ru")}</span>
          <span className="cr-cur">₽</span>
        </div>
        <div className="cr-note">
          Чаще всего — около <b style={{ color: "#fff" }}>{mid.toLocaleString("ru")} ₽</b>.
          Диагностика бесплатно, точную цену мастер фиксирует до начала работ.
        </div>
        {diy && (
          <div className="cr-diy">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0012 2z" />
            </svg>
            <span>Можно попробовать самому: {diy}</span>
          </div>
        )}
        <a className="btn btn-accent" href="#lead-form" style={{ width: "100%", marginTop: 16 }}>
          Вызвать мастера по этой цене
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>
    </div>
  );
}
