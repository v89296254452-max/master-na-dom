import { NextResponse } from "next/server";

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
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
 */
async function sendLeadToGoogleSheets(lead: LeadPayload): Promise<void> {
  const webhookUrl = process.env.LEADS_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[LEAD] LEADS_WEBHOOK_URL не задан — заявка сохранена только в логах");
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
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

    const name = getString(body.name);
    const phoneRaw = getString(body.phone);
    const phone = cleanPhone(phoneRaw);

    if (!name || !phoneRaw) {
      return NextResponse.json(
        { success: false, error: "Имя и телефон обязательны" },
        { status: 400 }
      );
    }

    if (phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { success: false, error: "Некорректный телефон" },
        { status: 400 }
      );
    }

    const lead: LeadPayload = {
      createdAt: new Date().toISOString(),
      name,
      phone,
      problem: getString(body.problem),
      city: getString(body.city),
      service: getString(body.service),
      slug: getString(body.slug),
      source: getString(body.source) || "seo",
      userAgent: request.headers.get("user-agent") ?? "",
      ip: getClientIp(request),
    };

    console.log("[LEAD]", JSON.stringify(lead, null, 2));

    try {
      await sendLeadToGoogleSheets(lead);
    } catch (error) {
      console.error("[LEAD] Google Sheets недоступен:", error);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
