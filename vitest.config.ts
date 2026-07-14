import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Two projects:
 *  - `unit`        — pure logic (lib), theme data, and React component tests
 *                    (jsdom). Fast, no I/O.
 *  - `integration` — repositories + services against a real in-process Postgres
 *                    (pglite). node environment, longer timeout.
 *
 * Coverage floors (§II.10) are enforced over the *testable core* only —
 * lib / services / db/repositories / themes. UI surfaces covered by Playwright
 * (§II.10 E2E) are intentionally outside the unit-coverage denominator; see
 * docs/rules/conventions.md (DT-6).
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        plugins: [react()],
        test: {
          name: "unit",
          environment: "jsdom",
          include: [
            "lib/**/*.test.{ts,tsx}",
            "themes/**/*.test.{ts,tsx}",
            "components/**/*.test.{ts,tsx}",
          ],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["db/**/*.test.ts", "services/**/*.test.ts"],
          testTimeout: 20000,
          hookTimeout: 30000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "json"],
      include: [
        "lib/**/*.ts",
        "services/**/*.ts",
        "db/repositories/**/*.ts",
        "themes/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "themes/_template.ts",
        "**/index.ts",
      ],
      thresholds: {
        "lib/**": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "services/**": { lines: 90 },
        "db/repositories/**": { lines: 85 },
        lines: 80,
      },
    },
  },
});
