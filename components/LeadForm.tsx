"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { formatRuPhone, isValidRuPhone } from "@/lib/phone-format";
import { attributionPayload } from "@/lib/attribution";

interface LeadFormProps {
  service: string;
  city: string;
  cityPrepositional: string;
  slug: string;
}

declare global {
  interface Window {
    ym?: (id: number, method: string, target: string) => void;
  }
}
const YM_COUNTER_ID = 110026692;
const YM_GOAL = "lead_submit";

function sendMetrikaGoal() {
  if (typeof window !== "undefined" && typeof window.ym === "function") {
    window.ym(YM_COUNTER_ID, "reachGoal", YM_GOAL);
  }
}

export default function LeadForm({
  service,
  city,
  cityPrepositional,
  slug,
}: LeadFormProps) {
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

    const attr = attributionPayload();
    const payload = {
      name: String(formData.get("name") ?? ""),
      phone,
      problem: String(formData.get("problem") ?? ""),
      city: String(formData.get("city") ?? ""),
      service: String(formData.get("service") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      // source из UTM (платный трафик), иначе дефолт формы (seo)
      source: attr.utmSource || String(formData.get("source") ?? "seo"),
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
    } catch (err) {
      console.error("Lead submit error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border-[1.5px] border-border bg-surface px-4 py-3 text-ink outline-none transition-colors focus:border-accent focus:ring-[3px] focus:ring-accent/10 disabled:opacity-60";

  return (
    <section id="lead-form" className="scroll-mt-20 bg-bg px-6 py-12">
      <div className="mx-auto max-w-[600px] rounded-2xl border border-border bg-surface p-6 shadow-[0_4px_16px_rgba(0,0,0,0.08)] sm:p-10">
        <h2 className="text-2xl font-bold text-ink">Оставить заявку</h2>
        <p className="mt-1 text-muted">Мастер перезвонит в течение 5 минут</p>

        {submitted ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-lg font-semibold text-success">Заявка отправлена</p>
            <p className="mt-2 text-muted">Мастер свяжется с вами в ближайшее время.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="hidden" name="city" value={city} />
            <input type="hidden" name="service" value={service} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="source" value="seo" />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                Ошибка отправки, попробуйте позвонить
              </div>
            )}

            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink">
                Ваше имя
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                disabled={loading}
                placeholder="Иван"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-ink">
                Телефон
              </label>
              <input
                type="tel"
                inputMode="tel"
                id="phone"
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
                className={`${inputClass} ${phoneError ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : ""}`}
              />
              {phoneError && <p className="mt-1 text-sm text-red-600">{phoneError}</p>}
            </div>

            <div>
              <label htmlFor="problem" className="mb-1.5 block text-sm font-medium text-ink">
                Описание проблемы
              </label>
              <textarea
                id="problem"
                name="problem"
                required
                disabled={loading}
                rows={4}
                placeholder={`Опишите проблему с ${(service || "услугой").toLowerCase()} в ${cityPrepositional || "городе"}`}
                className={`${inputClass} min-h-[100px] resize-y`}
              />
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
              {loading ? "Отправка..." : "Отправить заявку"}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-center text-xs text-faint">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span>Ваши данные под защитой и не передаются третьим лицам</span>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
