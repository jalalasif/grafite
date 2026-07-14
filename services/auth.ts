import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

/**
 * Auth primitives (§II.3). Single password, no user table. Pure-ish logic kept
 * out of the route handlers so it is unit-testable: bcrypt comparison (constant
 * time), JWT session sign/verify (jose, HS256, 30-day), and an in-memory rate
 * limiter. The limiter resets on cold start — acceptable for a single-user app
 * on a single region (§II.3); noted in conventions.md.
 */

export const SESSION_COOKIE = "grafite_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

/** Constant-time password check against a bcrypt hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Sign a 30-day HS256 session token. */
export function createSession(secret: string): Promise<string> {
  return new SignJWT({ sub: "grafite" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(encoder.encode(secret));
}

/** True iff `token` is a valid, unexpired session signed with `secret`. */
export async function verifySession(
  token: string,
  secret: string,
): Promise<boolean> {
  try {
    await jwtVerify(token, encoder.encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export interface RateLimiter {
  check(key: string): { allowed: boolean; remaining: number };
}

/** Sliding-window in-memory rate limiter: at most `max` hits per `windowMs` per
 * key. `now` is injectable for tests. */
export function createRateLimiter(opts: {
  max: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const clock = opts.now ?? (() => Date.now());
  const hits = new Map<string, number[]>();
  return {
    check(key) {
      const t = clock();
      const windowStart = t - opts.windowMs;
      const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return { allowed: false, remaining: 0 };
      }
      recent.push(t);
      hits.set(key, recent);
      return { allowed: true, remaining: opts.max - recent.length };
    },
  };
}
