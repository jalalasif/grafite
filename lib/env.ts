import { z } from "zod";

/**
 * Startup environment validation (§II.12). `parseEnv` is a pure function over a
 * plain record so it is fully unit-testable; `getEnv` applies it to
 * `process.env` lazily and caches — nothing validates at import time, so
 * `next build` never fails on unset vars for a route that does not run at build.
 *
 * Pure: this module imports only `zod`, no framework (§II.4).
 */

// A bcrypt hash: $2a$/$2b$/$2y$, a two-digit cost, then the salt+digest in the
// bcrypt base64 alphabet. We check the shape to reject a plaintext password
// pasted in by mistake — not to re-implement bcrypt.
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{50,}$/;

const EnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "is required (Neon pooled connection string)"),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  AUTH_PASSWORD_HASH: z
    .string()
    .regex(BCRYPT_HASH, "must be a bcrypt hash, not a plaintext password"),
  AUTH_SECRET: z
    .string()
    .min(32, "must be at least 32 characters (32+ random bytes, base64)"),
  TZ: z.string().min(1).default("Asia/Dhaka"),
  DAILY_TEMPLATE: z.string().default("# {{date:YYYY-MM-DD}}\n\n"),
});

export type Env = z.infer<typeof EnvSchema>;

/** Validate a raw environment record, throwing a message that names every
 * offending key. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  const detail = result.error.issues
    .map((issue) => `${issue.path.join(".")} ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration — ${detail}`);
}

let cached: Env | undefined;

/** Validate `process.env` once and cache. Call at request time, not import
 * time. */
export function getEnv(): Env {
  return (cached ??= parseEnv(process.env));
}

/** Test-only: clear the cached env so a test can re-validate `process.env`. */
export function resetEnvCache(): void {
  cached = undefined;
}
