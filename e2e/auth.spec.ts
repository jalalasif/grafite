import { test, expect } from "@playwright/test";

/**
 * Auth E2E (§II.10 spec 1, the DB-free parts). These run against a real Next
 * server with dummy auth env (see playwright.config). The "correct password →
 * note list" leg needs a real database and is owed verification against the
 * architect's Neon.
 */

test("an unauthenticated visit to a protected route redirects to /login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Grafite" })).toBeVisible();
});

test("the wrong password shows an error, not a stack trace", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  // Scope to the form's alert (Next also renders a route-announcer with role=alert).
  await expect(page.getByText(/incorrect password/i)).toBeVisible();
});
