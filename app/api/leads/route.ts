import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { insertLead } from "@/lib/leads-store";
import { sendLeadToOmni } from "@/lib/leads-omni";

export interface LeadPayload {
  createdAt: string;
  name: string;
  phone: string;
  problem: string;
  city: string;
  service: string;
  slug: string;
  source: string;
  userAgent: string;
  ip: string;
  secret?: string;
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Строгая валидация телефона на сервере (в отличие от клиентской маски —
 * тут это последний рубеж перед записью в CRM/таблицу). Ровно 10 цифр после
 * приведения 8/9XXXXXXXXXX → 7XXXXXXXXXX.
 */
function normalizeAndValidatePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10 && d.startsWith("9")) d = "7" + d;
  if (d.length !== 11 || !d.startsWith("7")) return null;
  return d;
}

/**
 * Имя должно содержать хотя бы 2 буквы (кириллица/латиница). Отсекает
 * заявки с битой кодировкой (crlf/не-UTF8 payload → "???" / replacement
 * chars) и совсем пустой мусор, которые раньше уходили в Google Sheets как
 * есть.
 */
function isSaneName(name: string): boolean {
  const letters = name.match(/[a-zA-Zа-яА-ЯёЁ]/g);
  return !!letters && letters.length >= 2;
}

/**
 * U+FFFD (REPLACEMENT CHARACTER) появляется, когда JSON.parse получает
 * байты, которые не были валидным UTF-8 (например бот шлёт body в другой
 * кодировке). Живой пример из логов: `service=????+?????????` — сама
 * заявка успешно прошла все прежние проверки (телефон был ≥10 цифр), но
 * текстовые поля были уже необратимо испорчены на входе. Ловим это явно,
 * а не гадаем по эвристикам вроде "мало букв".
 */
function hasReplacementChar(value: string): boolean {
  return value.includes("�");
}

/**
 * Защита Google Sheets от formula/CSV-инъекции: значения, начинающиеся с
 * = + - @ (или таб/CR), Google Sheets может интерпретировать как формулу.
 * Экранируем ведущим апострофом.
 */
function sanitizeForSheets(value: string): string {
  if (value && /^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

// Простой in-memory rate-limit по IP (процесс PM2 в fork-режиме — один инстанс).
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 минут
const RATE_MAX = 5; // не более 5 заявок с одного IP за окно
const rateHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  if (!ip) return false;
  const now = Date.now();
  const hits = (rateHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateHits.set(ip, hits);
  // лёгкая уборка, чтобы Map не рос бесконечно
  if (rateHits.size > 5000) {
    for (const [k, v] of rateHits) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) rateHits.delete(k);
    }
  }
  return hits.length > RATE_MAX;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "";
  }

  return request.headers.get("x-real-ip") ?? "";
}

/**
 * Отправка лида в Google Sheets через Google Apps Script Web App.
 * URL вебхука задаётся в .env.local:
 * LEADS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
 *
 * `secret` (LEADS_WEBHOOK_SECRET) прокидывается в теле и проверяется внутри
 * doPost() самого Apps Script — так как URL вебхука публичный (Anyone),
 * это единственный барьер от прямых POST-запросов в обход этого route.ts
 * (а именно так, судя по всему, в таблицу и попадали заявки с 7-значным
 * "телефоном" и битой кодировкой имени).
 */
async function sendLeadToGoogleSheets(lead: LeadPayload): Promise<void> {
  const webhookUrl = process.env.LEADS_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[LEAD] LEADS_WEBHOOK_URL не задан — заявка сохранена только в логах");
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...lead, secret: process.env.LEADS_WEBHOOK_SECRET || undefined }),
    redirect: "follow",
  });

  const responseText = await response.text().catch(() => "");
  console.log("[LEAD] Webhook status:", response.status, "body:", responseText);

  if (!response.ok) {
    throw new Error(`Google Sheets webhook error ${response.status}: ${responseText}`);
  }
}

export async function GET() {
  return Response.json({
    success: true,
    route: "/api/leads",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Honeypot: скрытое поле, которое не заполняют реальные люди.
    // Если заполнено — это бот. Тихо отвечаем «успех», но заявку не обрабатываем.
    if (getString(body.company) || getString(body.website)) {
      return NextResponse.json({ success: true });
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: "Слишком много заявок. Попробуйте позже или позвоните нам." },
        { status: 429 }
      );
    }

    const name = getString(body.name);
    const phoneRaw = getString(body.phone);
    const phone = normalizeAndValidatePhone(phoneRaw);
    const problem = getString(body.problem);
    const city = getString(body.city);
    const service = getString(body.service);

    if (!name || !phoneRaw) {
      return NextResponse.json(
        { success: false, error: "Имя и телефон обязательны" },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Некорректный телефон" },
        { status: 400 }
      );
    }

    if (!isSaneName(name)) {
      return NextResponse.json(
        { success: false, error: "Некорректное имя" },
        { status: 400 }
      );
    }

    if ([name, problem, city, service].some(hasReplacementChar)) {
      // Битая кодировка на входе (не наш браузерный код это шлёт — form
      // всегда UTF-8). Тихо отвечаем "успех", ничего не пишем ни в Sheets,
      // ни в локальную БД.
      return NextResponse.json({ success: true });
    }

    const lead: LeadPayload = {
      createdAt: new Date().toISOString(),
      name: sanitizeForSheets(name),
      phone,
      problem: sanitizeForSheets(problem),
      city: sanitizeForSheets(city),
      service: sanitizeForSheets(service),
      slug: sanitizeForSheets(getString(body.slug)),
      source: sanitizeForSheets(getString(body.source) || "seo"),
      userAgent: request.headers.get("user-agent") ?? "",
      ip,
    };

    // Не логируем персональные данные (имя/телефон/IP) в открытом виде —
    // только факт заявки и обезличенный контекст.
    console.log(
      `[LEAD] new: service=${lead.service || "-"} city=${lead.city || "-"} source=${lead.source}`
    );

    const internalId = randomUUID();
    const adClickid = sanitizeForSheets(getString(body.clickid)).slice(0, 200);
    const campaign = sanitizeForSheets(getString(body.utmCampaign)).slice(0, 120);

    // Партнёрская CRM (omni.asy.dev) — прямая отправка. Не блокирует лид:
    // если город/услуга не покрыты CRM или её API недоступен, заявка всё
    // равно уходит в Google Sheets/локальную БД ниже.
    const omniResult: Awaited<ReturnType<typeof sendLeadToOmni>> = await sendLeadToOmni({
      name,
      phone,
      problem: lead.problem,
      city: lead.city,
      service: lead.service,
      serviceSlug: lead.slug,
    }).catch((e) => ({
      sent: false,
      error: e instanceof Error ? e.message : "network",
    }));

    if (!omniResult.sent) {
      console.warn(`[LEAD] omni CRM не приняла заявку: ${omniResult.error || "unknown"}`);
    }

    let sheetsOk = false;
    try {
      await sendLeadToGoogleSheets(lead);
      sheetsOk = true;
    } catch (e) {
      console.error("[LEAD] Google Sheets недоступен:", e);
    }

    try {
      insertLead({
        id: internalId,
        name,
        phone,
        city: lead.city,
        service: lead.service,
        slug: lead.slug,
        source: lead.source,
        offerId: omniResult.categoryId,
        cityId: omniResult.departmentId,
        partnerSent: omniResult.sent,
        partnerStatus: omniResult.status,
        partnerError: omniResult.error,
        sheetsOk,
        clickid: adClickid || undefined,
        campaign: campaign || undefined,
      });
    } catch (e) {
      console.error("[LEAD] store insert error:", e);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
