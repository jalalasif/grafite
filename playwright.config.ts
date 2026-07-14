import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E runs against a real Next server (§II.10). Locally it drives `pnpm dev`;
 * in CI the e2e job builds first, so it drives `pnpm start`. No retries — a
 * flaky test is fixed or deleted, never retried into green (§II.11).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Dummy-but-valid env so middleware/login run without a real .env. The
    // password hash is bcrypt("grafite-e2e"); DATABASE_URL is a placeholder
    // (auth/redirect specs don't hit the DB — DB-backed specs are owed against
    // a real Neon endpoint).
    env: {
      AUTH_SECRET: "e2e-secret-000000000000000000000000000000",
      AUTH_PASSWORD_HASH:
        process.env.AUTH_PASSWORD_HASH ??
        "$2b$10$vuk3fj/9oFeRej6aTP1IYOuUyYmPckyZQLd3eyB8mqdzHG6ogsSOy",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://placeholder/placeholder",
    },
  },
});
