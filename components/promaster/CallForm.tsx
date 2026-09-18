"use client";

import { useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { formatRuPhone, isValidRuPhone } from "@/lib/phone-format";
import { attributionPayload } from "@/lib/attribution";
import {
  UNKNOWN_SERVICE,
  mergeCityOptions,
  mergeServiceOptions,
} from "@/lib/offer-catalog";

declare global {
  interface Window {
    ym?: (id: number, method: string, target: string) => void;
  }
}
const YM_COUNTER_ID = 110026692;

interface CallFormProps {
  services?: string[];
  cities?: string[];
  defaultService?: string;
  defaultCity?: string;
  slug?: string;
  source?: string;
}

export default function CallForm({
  services = [],
  cities = [],
  defaultService,
  defaultCity,
  slug = "",
  source = "home",
}: CallFormProps) {
  const serviceOptions = useMemo(
    () => mergeServiceOptions(defaultService, services),
    [services, defaultService]
  );
  const cityOptions = useMemo(
    () => mergeCityOptions(defaultCity, cities),
    [cities, defaultCity]
  );

  const [service, setService] = useState(defaultService || serviceOptions[0] || "");
  const [city, setCity] = useState(defaultCity || cityOptions[0] || "");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValidRuPhone(phone)) {
      setPhoneError("Введите корректный номер телефона");
      return;
    }
    setPhoneError(null);
    setError(false);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const attr = attributionPayload();
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Заявка с сайта",
          phone,
          problem: "",
          city: String(fd.get("city") ?? city),
          service: String(fd.get("service") ?? service),
          company: String(fd.get("company") ?? ""),
          slug,
          source: attr.utmSource || source,
          ...attr,
        }),
      });
      const r = await res.json();
      if (!res.ok || !r.success) throw new Error();
      setPhone("");
      // Каст вместо window.ym(...) напрямую: глобальный Window.ym объявлен выше
      // с сигнатурой без 4-го аргумента (params) — см. тот же приём в OfferPopup.tsx.
      const ym = (window as unknown as { ym?: (...args: unknown[]) => void }).ym;
      if (typeof ym === "function") {
        ym(YM_COUNTER_ID, "reachGoal", "lead_submit", {
          city: String(fd.get("city") ?? city),
          service: String(fd.get("service") ?? service),
          slug,
          pageType: source,
        });
      }
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="callcard" id="lead-form">
        <div className="cc-top">
          <span className="cc-pulse" aria-hidden>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <div>
            <div className="cc-title">Заявка отправлена</div>
            <div className="cc-sub">Мастер перезвонит в течение 5 минут</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="callcard" id="lead-form">
      <div className="cc-top">
        <span className="cc-pulse" aria-hidden>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.7 2z" />
          </svg>
        </span>
        <div>
          <div className="cc-title">Перезвоним за 5 минут</div>
          <div className="cc-sub">Подберём мастера рядом и назовём цену</div>
        </div>
      </div>
      <form onSubmit={handleSubmit} key={`${defaultService ?? ""}-${defaultCity ?? ""}`}>
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />
        {error && (
          <div style={{ marginTop: 12, borderRadius: 11, background: "rgba(220,50,50,.08)", color: "#b91c1c", padding: "10px 13px", fontSize: 13 }}>
            Ошибка отправки, попробуйте позвонить
          </div>
        )}
        <div className="two">
          <div className="field">
            <label>Услуга</label>
            <select name="service" value={service} onChange={(e) => setService(e.target.value)}>
              {serviceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={UNKNOWN_SERVICE}>{UNKNOWN_SERVICE}</option>
            </select>
          </div>
          <div className="field">
            <label>Город</label>
            <select name="city" value={city} onChange={(e) => setCity(e.target.value)}>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Телефон</label>
          <input
            type="tel"
            inputMode="tel"
            name="phone"
            required
            value={phone}
            onChange={(e) => {
              setPhone(formatRuPhone(e.target.value));
              if (phoneError) setPhoneError(null);
            }}
            placeholder="+7 (___) ___-__-__"
            aria-invalid={phoneError ? true : undefined}
            style={phoneError ? { borderColor: "#dc4444" } : undefined}
          />
          {phoneError && <p style={{ marginTop: 6, fontSize: 13, color: "#dc2626" }}>{phoneError}</p>}
        </div>
        <label style={{ display: "flex", gap: 8, marginTop: 12, fontSize: 12, color: "var(--muted)", alignItems: "flex-start" }}>
          <input type="checkbox" required style={{ marginTop: 2, width: 16, height: 16, flex: "none" }} />
          <span>
            Я согласен на обработку персональных данных согласно{" "}
            <Link href="/politika-konfidencialnosti" target="_blank" style={{ textDecoration: "underline" }}>
              политике
            </Link>
          </span>
        </label>
        <button type="submit" className="btn btn-accent cc-btn" disabled={loading}>
          {loading ? "Отправка..." : "Вызвать мастера"}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <div className="cc-legal">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flex: "none", marginTop: 1 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span>Данные защищены и не передаются третьим лицам</span>
        </div>
      </form>
    </div>
  );
}
