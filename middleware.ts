import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Гейт авторизации для служебных разделов.
 *
 * Закрывает Basic-аутентификацией всю админку (`/admin/**`) и приватные API
 * (`/api/**`), кроме публичных эндпоинтов приёма заявок и health-check.
 * Браузер после первого ввода логина/пароля сам досылает заголовок
 * Authorization на same-origin fetch, поэтому админ-панели продолжают работать.
 *
 * Учётные данные берутся из env: ADMIN_USER / ADMIN_PASSWORD.
 * Если они не заданы — доступ закрыт полностью (fail-closed), чтобы случайно
 * не оставить всё открытым.
 */

// Публичные API-префиксы, которым авторизация не нужна.
const PUBLIC_API_PREFIXES = ["/api/health", "/api/leads", "/api/postback", "/api/offer-time"];

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ProMaster Admin", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

function isAuthorized(request: NextRequest): boolean {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  // Нет учёток в env — закрываем всё.
  if (!user || !password) return false;

  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Basic ")) return false;

  let decoded = "";
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return false;
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return false;

  const givenUser = decoded.slice(0, sep);
  const givenPass = decoded.slice(sep + 1);

  return givenUser === user && givenPass === password;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Публичные API пропускаем без проверки.
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  return unauthorized();
}

// Гейт только на служебные разделы; публичные страницы, _next, статика — мимо.
export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
