import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseEnv, getEnv, resetEnvCache } from "./env";

const VALID = {
  DATABASE_URL: "postgresql://user:pass@ep-cool.neon.tech/db?sslmode=require",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_XXXXXXXX",
  AUTH_PASSWORD_HASH:
    "$2b$12$abcdefghijklmnopqrstuv0123456789ABCDEFGHIJKLMNOPQRSTUV",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789ab",
} as const;

describe("parseEnv", () => {
  it("parses a fully valid environment", () => {
    const env = parseEnv({ ...VALID });
    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.AUTH_PASSWORD_HASH).toBe(VALID.AUTH_PASSWORD_HASH);
    expect(env.AUTH_SECRET).toBe(VALID.AUTH_SECRET);
    expect(env.BLOB_READ_WRITE_TOKEN).toBe(VALID.BLOB_READ_WRITE_TOKEN);
  });

  it("applies the TZ default when omitted", () => {
    const env = parseEnv({ ...VALID });
    expect(env.TZ).toBe("Asia/Dhaka");
  });

  it("applies the DAILY_TEMPLATE default when omitted", () => {
    const env = parseEnv({ ...VALID });
    expect(env.DAILY_TEMPLATE).toBe("# {{date:YYYY-MM-DD}}\n\n");
  });

  it("keeps an explicit TZ and DAILY_TEMPLATE", () => {
    const env = parseEnv({
      ...VALID,
      TZ: "UTC",
      DAILY_TEMPLATE: "## {{date:yyyy}}",
    });
    expect(env.TZ).toBe("UTC");
    expect(env.DAILY_TEMPLATE).toBe("## {{date:yyyy}}");
  });

  it("treats BLOB_READ_WRITE_TOKEN as optional", () => {
    const { BLOB_READ_WRITE_TOKEN: _omit, ...withoutBlob } = VALID;
    const env = parseEnv({ ...withoutBlob });
    expect(env.BLOB_READ_WRITE_TOKEN).toBeUndefined();
  });

  it("throws when DATABASE_URL is missing, naming the key", () => {
    const { DATABASE_URL: _omit, ...rest } = VALID;
    expect(() => parseEnv({ ...rest })).toThrowError(/DATABASE_URL/);
  });

  it("throws when AUTH_SECRET is too short", () => {
    expect(() => parseEnv({ ...VALID, AUTH_SECRET: "short" })).toThrowError(
      /AUTH_SECRET/,
    );
  });

  it("throws when AUTH_PASSWORD_HASH is not a bcrypt hash", () => {
    expect(() =>
      parseEnv({ ...VALID, AUTH_PASSWORD_HASH: "plaintext-password" }),
    ).toThrowError(/AUTH_PASSWORD_HASH/);
  });

  it("accepts each bcrypt prefix variant ($2a$, $2b$, $2y$)", () => {
    for (const prefix of ["$2a$", "$2b$", "$2y$"]) {
      const hash = prefix + "12$" + "a".repeat(53);
      expect(() =>
        parseEnv({ ...VALID, AUTH_PASSWORD_HASH: hash }),
      ).not.toThrow();
    }
  });

  it("reports every invalid key at once", () => {
    let message = "";
    try {
      parseEnv({ AUTH_SECRET: "x" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/AUTH_PASSWORD_HASH/);
    expect(message).toMatch(/AUTH_SECRET/);
  });
});

describe("getEnv", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    resetEnvCache();
    Object.assign(process.env, VALID);
  });

  afterEach(() => {
    resetEnvCache();
    for (const k of Object.keys(VALID))
      delete (process.env as Record<string, unknown>)[k];
    Object.assign(process.env, saved);
  });

  it("validates process.env and caches the result", () => {
    const first = getEnv();
    const second = getEnv();
    expect(first.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(second).toBe(first); // same cached reference
  });
});
