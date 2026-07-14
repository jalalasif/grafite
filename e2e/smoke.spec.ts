import { test, expect } from "@playwright/test";

/**
 * Phase-1 smoke test: proves the E2E harness is load-bearing from the first
 * commit (§II.11) — the app builds, serves, and the shell renders. Later phases
 * add the real specs from §II.10.
 */
test("app boots and serves the Grafite shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Grafite/);
});
