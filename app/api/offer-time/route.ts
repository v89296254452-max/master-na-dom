import { NextResponse } from "next/server";
import { DISCOUNT_PERCENT, OFFER_TIMEZONE } from "@/lib/offer-config";

/**
 * Серверное время для countdown попапа-оффера (не доверяем часам браузера).
 * Europe/Moscow — фиксированный UTC+3 (без перехода на летнее время в РФ
 * с 2014), поэтому чистая арифметика без tz-библиотек. Оффер истекает
 * в конец текущих суток по МСК.
 */
export const dynamic = "force-dynamic";

function endOfTodayMoscow(now: Date): Date {
  const mskShifted = new Date(now.getTime() + 3 * 3_600_000);
  const y = mskShifted.getUTCFullYear();
  const m = mskShifted.getUTCMonth();
  const d = mskShifted.getUTCDate();
  const nextMskMidnightUtc = Date.UTC(y, m, d + 1, 0, 0, 0, 0) - 3 * 3_600_000;
  return new Date(nextMskMidnightUtc - 1);
}

export async function GET() {
  const now = new Date();
  const offerExpiresAt = endOfTodayMoscow(now);
  return NextResponse.json(
    {
      serverNow: now.toISOString(),
      offerExpiresAt: offerExpiresAt.toISOString(),
      timezone: OFFER_TIMEZONE,
      discountPercent: DISCOUNT_PERCENT,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
