import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import {
  verifyPassword,
  createSession,
  verifySession,
  createRateLimiter,
} from "./auth";

const SECRET = "test-secret-000000000000000000000000000000";

describe("verifyPassword", () => {
  it("accepts the right password and rejects the wrong one", async () => {
    const hash = bcrypt.hashSync("calvino", 8);
    expect(await verifyPassword("calvino", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a signed session", async () => {
    const token = await createSession(SECRET);
    expect(await verifySession(token, SECRET)).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSession(SECRET);
    expect(
      await verifySession(token, "another-secret-1111111111111111111"),
    ).toBe(false);
  });

  it("rejects a garbage token", async () => {
    expect(await verifySession("not.a.jwt", SECRET)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ sub: "grafite" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(expired, SECRET)).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("allows up to max attempts then blocks within the window", () => {
    const now = 1000;
    const limiter = createRateLimiter({
      max: 3,
      windowMs: 1000,
      now: () => now,
    });
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
    const blocked = limiter.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    const now = 0;
    const limiter = createRateLimiter({
      max: 1,
      windowMs: 100,
      now: () => now,
    });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("resets once the window elapses", () => {
    let now = 0;
    const limiter = createRateLimiter({
      max: 1,
      windowMs: 100,
      now: () => now,
    });
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(false);
    now = 101;
    expect(limiter.check("ip").allowed).toBe(true);
  });
});
