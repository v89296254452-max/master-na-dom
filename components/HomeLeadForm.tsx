"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { formatRuPhone, isValidRuPhone } from "@/lib/phone-format";
import { attributionPayload } from "@/lib/attribution";

interface ServiceOption {
  value: string;
  label: string;
}

interface HomeLeadFormProps {
  services: ServiceOption[];
  cities: string[];
}

declare global {
  interface Window {
    ym?: (id: number, method: string, target: string) => void;
  }
}

const YM_COUNTER_ID = 110026692;

function sendMetrikaGoal() {
  if (typeof window !== "undefined" && typeof window.ym === "function") {
    window.ym(YM_COUNTER_ID, "reachGoal", "lead_submit");
  }
}

export default function HomeLeadForm({ services, cities }: HomeLeadFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isValidRuPhone(phone)) {
      setPhoneError("Введите корректный номер телефона");
      return;
    }
    setPhoneError(null);
    setError(false);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const service = String(formData.get("service") ?? "");
    const city = String(formData.get("city") ?? "");

    const attr = attributionPayload();
    const payload = {
      name: "Заявка с главной",
      phone,
      problem: "",
      city,
      service,
      slug: "",
      source: attr.utmSource || "home",
      ...attr,
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Ошибка отправки");
      }

      form.reset();
      setPhone("");
      sendMetrikaGoal();
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        <p className="text-lg font-semibold text-success">Заявка отправлена</p>
        <p className="mt-2 text-muted">Мастер свяжется с вами в течение 5 минут.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] sm:p-8">
      <h2 className="text-2xl font-bold text-ink">Оставить заявку</h2>
      <p className="mt-1 text-sm text-muted">Мастер перезвонит в течение 5 минут</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input type="hidden" name="name" value="Заявка с главной" />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Ошибка отправки, попробуйте позвонить
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="home-service" className="mb-1.5 block text-sm font-medium text-ink">
              Услуга
            </label>
            <select
              id="home-service"
              name="service"
              disabled={loading}
              defaultValue=""
              className="w-full rounded-lg border-[1.5px] border-border bg-surface px-4 py-3 text-ink outline-none transition-colors focus:border-accent focus:ring-[3px] focus:ring-accent/10 disabled:opacity-60"
            >
              <option value="" disabled>
                Выберите услугу
              </option>
              {services.map((s) => (
                <option key={s.value} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="home-city" className="mb-1.5 block text-sm font-medium text-ink">
              Город
            </label>
            <select
              id="home-city"
              name="city"
              disabled={loading}
              defaultValue=""
              className="w-full rounded-lg border-[1.5px] border-border bg-surface px-4 py-3 text-ink outline-none transition-colors focus:border-accent focus:ring-[3px] focus:ring-accent/10 disabled:opacity-60"
            >
              <option value="" disabled>
                Выберите город
              </option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="home-phone" className="mb-1.5 block text-sm font-medium text-ink">
              Телефон
            </label>
            <input
              type="tel"
              inputMode="tel"
              id="home-phone"
              name="phone"
              required
              disabled={loading}
              value={phone}
              onChange={(e) => {
                setPhone(formatRuPhone(e.target.value));
                if (phoneError) setPhoneError(null);
              }}
              placeholder="+7 (___) ___-__-__"
              aria-invalid={phoneError ? true : undefined}
              className={`w-full rounded-lg border-[1.5px] bg-surface px-4 py-3 text-ink outline-none transition-colors focus:ring-[3px] disabled:opacity-60 ${
                phoneError
                  ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                  : "border-border focus:border-accent focus:ring-accent/10"
              }`}
            />
            {phoneError && <p className="mt-1 text-sm text-red-600">{phoneError}</p>}
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs text-muted">
          <input
            type="checkbox"
            name="consent"
            required
            disabled={loading}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
          />
          <span>
            Я согласен на обработку персональных данных согласно{" "}
            <Link
              href="/politika-konfidencialnosti"
              target="_blank"
              className="underline hover:text-accent"
            >
              политике конфиденциальности
            </Link>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex h-[52px] w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? "Отправка..." : "Вызвать мастера →"}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-center text-xs text-faint">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span>Бесплатная консультация · Без предоплаты</span>
        </div>
      </form>
    </div>
  );
}
