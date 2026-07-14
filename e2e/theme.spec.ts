import { test, expect } from "@playwright/test";

/**
 * Theme system E2E (Amendment 1): the toggle flips light/dark at runtime with no
 * flash, and the choice survives a reload because the head FOUC script restores
 * it before paint. Contrast in both modes is proven by themes/registry.test.ts.
 */
test("toggling dark mode flips data-mode and persists across reload", async ({
  page,
}) => {
  await page.goto("/login");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-mode", "light");

  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-mode", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-mode", "dark");
});
