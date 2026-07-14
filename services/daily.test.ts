import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, withRollback, type TestDb } from "@/db/testing";
import {
  resolveDailyDate,
  renderDailyTemplate,
  getOrCreateDaily,
} from "./daily";
import { resetEnvCache } from "@/lib/env";

let h: TestDb;
beforeAll(async () => {
  // getOrCreateDaily → getEnv() validates the whole process.env, so satisfy the
  // required keys and pin DAILY_TEMPLATE to the spec default for deterministic
  // bodies. resetEnvCache() forces getEnv to re-read what we just set.
  process.env.DATABASE_URL = "postgres://localhost/test";
  process.env.AUTH_PASSWORD_HASH =
    "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  process.env.AUTH_SECRET = "test-secret-that-is-definitely-long-enough-000";
  process.env.DAILY_TEMPLATE = "# {{date:YYYY-MM-DD}}\n\n";
  resetEnvCache();
  h = await createTestDb();
});
afterAll(async () => {
  await h.close();
});
const run = <T>(fn: Parameters<typeof withRollback<T>>[1]) =>
  withRollback(h.db, fn);

describe("resolveDailyDate", () => {
  // 2026-07-14 19:00Z == 2026-07-15 01:00 in Asia/Dhaka (+06).
  const instant = new Date("2026-07-14T19:00:00Z");

  it("dates an instant by the calendar day in the target zone", () => {
    expect(resolveDailyDate(instant, "Asia/Dhaka")).toBe("2026-07-15");
  });

  it("dates the same instant differently in UTC (proving TZ matters)", () => {
    expect(resolveDailyDate(instant, "UTC")).toBe("2026-07-14");
  });

  it("keeps just-after-midnight local time on the new day, not the previous", () => {
    // 2026-07-14 18:30Z == 2026-07-15 00:30 in Asia/Dhaka.
    expect(
      resolveDailyDate(new Date("2026-07-14T18:30:00Z"), "Asia/Dhaka"),
    ).toBe("2026-07-15");
  });
});

describe("renderDailyTemplate", () => {
  it("renders the default (moment-style) template via the compat mapping", () => {
    expect(renderDailyTemplate("# {{date:YYYY-MM-DD}}\n\n", "2026-07-15")).toBe(
      "# 2026-07-15\n\n",
    );
  });

  it("renders a date-fns format string", () => {
    expect(renderDailyTemplate("{{date:MMMM d, yyyy}}", "2026-07-15")).toBe(
      "July 15, 2026",
    );
  });

  it("leaves text without a placeholder untouched", () => {
    expect(renderDailyTemplate("just some text", "2026-07-15")).toBe(
      "just some text",
    );
  });

  it("replaces every placeholder", () => {
    expect(
      renderDailyTemplate(
        "{{date:YYYY}} / {{date:MMMM}} / {{date:DD}}",
        "2026-07-15",
      ),
    ).toBe("2026 / July / 15");
  });
});

describe("getOrCreateDaily", () => {
  it("creates the daily note the first time", async () => {
    await run(async (tx) => {
      const note = await getOrCreateDaily(tx, "2026-07-15");
      expect(note.isDaily).toBe(true);
      expect(note.dailyDate).toBe("2026-07-15");
      expect(note.title).toBe("2026-07-15");
      expect(note.body).toBe("# 2026-07-15\n\n");
    });
  });

  it("returns the same note (no duplicate) on a repeat call for that date", async () => {
    await run(async (tx) => {
      const first = await getOrCreateDaily(tx, "2026-07-15");
      const second = await getOrCreateDaily(tx, "2026-07-15");
      expect(second.id).toBe(first.id);
    });
  });
});
