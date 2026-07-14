import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyPassword,
  createSession,
  createRateLimiter,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/services/auth";
import { getEnv } from "@/lib/env";
import { jsonError } from "@/app/api/_response";

// In-memory limiter: 5 attempts per IP per 15 minutes (§II.3). Resets on cold
// start — acceptable for a single-user, single-region app (conventions.md).
const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

const Body = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!limiter.check(ip).allowed) {
    return jsonError(
      "rate_limited",
      "Too many attempts. Try again in a few minutes.",
      429,
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return jsonError("bad_request", "A password is required.", 400, {
      issues: parsed.error.flatten(),
    });
  }

  const env = getEnv();
  const ok = await verifyPassword(parsed.data.password, env.AUTH_PASSWORD_HASH);
  if (!ok) {
    return jsonError("invalid_credentials", "Incorrect password.", 401);
  }

  const token = await createSession(env.AUTH_SECRET);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
