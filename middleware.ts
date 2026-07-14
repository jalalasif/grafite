import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/services/auth";
import { getEnv } from "@/lib/env";

/**
 * Auth gate (§II.3). Everything is protected except `/login`, the login API, and
 * static assets (excluded by the matcher). An unauthenticated page request
 * redirects to `/login`; an unauthenticated API request gets a 401 JSON in the
 * consistent error shape. Uses only jose + zod (Edge-safe) — never bcrypt, which
 * lives in the Node-runtime login route.
 */

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = token
    ? await verifySession(token, getEnv().AUTH_SECRET)
    : false;

  if (authed || isPublic(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and common static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
