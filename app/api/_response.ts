import { NextResponse } from "next/server";

/**
 * The single consistent API error shape (§II.7): every route returns
 * `{ error: { code, message, details? } }` on failure. Not a route file (leading
 * underscore), just a shared helper for the handlers under app/api.
 */
export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
