import { NextResponse } from "next/server";
import { applyPostback } from "@/lib/leads-store";

/**
 * Приём постбэков от партнёрской CRM ServiceLead.
 * Партнёрка дёргает этот URL при смене статуса лида. Мы логируем статус/комиссию
 * (это и есть автоматический отчёт «заявка → выкуп»).
 *
 * URL для кабинета (раздел «Постбеки»):
 *   https://master-na-dom.online/api/postback?status={status}&lead_id={lead_id}&order_id={order_id}&commission={commission}&date={date}&sub1={sub_id1}
 * (добавить &secret=... в конец, если задан POSTBACK_SECRET)
 *
 * Опционально: POSTBACK_SECRET (защита от подделки), POSTBACK_SHEET_URL
 * (переслать статус в Google Sheets тем же вебхуком).
 */

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams;

  const secret = process.env.POSTBACK_SECRET;
  if (secret && q.get("secret") !== secret) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const data = {
    status: q.get("status") || "",       // pending | approved | rejected
    leadId: q.get("lead_id") || "",
    orderId: q.get("order_id") || "",
    commission: q.get("commission") || "",
    date: q.get("date") || "",
    sub1: q.get("sub1") || q.get("sub_id1") || "",
  };

  console.log(
    `[POSTBACK] status=${data.status} lead=${data.leadId} order=${data.orderId} commission=${data.commission} sub1=${data.sub1}`
  );

  // Связываем с нашей заявкой по sub1 (= internalId, который мы передали как sub_id1).
  if (data.sub1) {
    try {
      const matched = applyPostback(data.sub1, {
        status: data.status || undefined,
        orderId: data.orderId || undefined,
        leadIdPartner: data.leadId || undefined,
        commission: data.commission || undefined,
      });
      if (!matched) console.warn(`[POSTBACK] лид с id=${data.sub1} не найден в локальной базе`);
    } catch (e) {
      console.error("[POSTBACK] store update error:", e);
    }
  }

  // Пересылка статуса в Google Sheets (если настроен отдельный вебхук статусов)
  const sheetUrl = process.env.POSTBACK_SHEET_URL;
  if (sheetUrl) {
    try {
      await fetch(sheetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "postback", ...data }),
      });
    } catch (e) {
      console.error("[POSTBACK] sheet forward error:", e);
    }
  }

  // Партнёрке важен 200 — иначе будет ретраить
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
