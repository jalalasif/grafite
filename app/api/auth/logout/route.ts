import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/services/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Expire the session cookie.
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
