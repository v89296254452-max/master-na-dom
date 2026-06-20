"use client";

import { useState, FormEvent } from "react";

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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      problem: String(formData.get("problem") ?? ""),
      city: String(formData.get("city") ?? ""),
      service: String(formData.get("service") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      source: String(formData.get("source") ?? "seo"),
    };

    try {
      console.log("Sending lead:", payload);

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("Lead API response:", result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Ошибка отправки");
      }

      form.reset();
      sendMetrikaGoal();
      setSubmitted(true);
    } catch (err) {
      console.error("Lead submit error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-800">Заявка отправлена</p>
        <p className="mt-2 text-green-700">Мастер свяжется с вами в ближайшее время.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="service" value={service} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="source" value="seo" />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          Ошибка отправки, попробуйте позвонить
        </div>
      )}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-navy">
          Ваше имя
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          disabled={loading}
          placeholder="Иван"
          className="w-full rounded-xl border border-gray-border px-4 py-3 text-navy outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-navy">
          Телефон
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          required
          disabled={loading}
          placeholder="+7 (___) ___-__-__"
          className="w-full rounded-xl border border-gray-border px-4 py-3 text-navy outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="problem" className="mb-1 block text-sm font-medium text-navy">
          Описание проблемы
        </label>
        <textarea
          id="problem"
          name="problem"
          required
          disabled={loading}
          rows={4}
          placeholder={`Опишите проблему с ${(service || "услугой").toLowerCase()} в ${cityPrepositional || "городе"}`}
          className="w-full resize-y rounded-lg border border-gray-border px-4 py-3 text-navy outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-orange px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-60"
      >
        {loading ? "Отправка..." : "Отправить заявку"}
      </button>
    </form>
  );
}
