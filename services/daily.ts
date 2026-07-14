import { format } from "date-fns";
import { type Db } from "@/db/client";
import { type Note } from "@/db/repositories/types";
import { notesRepo } from "@/db/repositories/notes";
import { createNote } from "@/services/note-sync";
import { getEnv } from "@/lib/env";

/**
 * Daily notes (§II.6.5). Three concerns kept apart so the time-zone core and the
 * template rendering are pure and unit-testable, and only {@link getOrCreateDaily}
 * touches the database:
 *   1. {@link resolveDailyDate} — which calendar day an instant belongs to, in a
 *      given IANA zone (a note written at 00:30 in Asia/Dhaka is *today's*).
 *   2. {@link renderDailyTemplate} — expand the `{{date:FORMAT}}` placeholders.
 *   3. {@link getOrCreateDaily} — find-or-create the single note for a date.
 */

/**
 * The calendar date at instant `now` in IANA time zone `tz`, formatted
 * `YYYY-MM-DD`. `en-CA` renders exactly that ISO order, and `timeZone` shifts the
 * instant into the target zone before the fields are read — so this is TZ-correct
 * across midnight boundaries (00:30 +06 stays on the same local day).
 */
export function resolveDailyDate(now: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// A `{{date:FORMAT}}` placeholder; FORMAT is everything up to the closing braces.
const DATE_PLACEHOLDER = /\{\{date:([^}]+)\}\}/g;

/**
 * The spec's default template uses moment-style tokens (`YYYY`, `DD`); date-fns
 * spells those `yyyy`/`dd`. Map just those two so the default keeps working while
 * every other token passes through to date-fns unchanged.
 */
function toDateFnsFormat(fmt: string): string {
  return fmt.replace(/YYYY/g, "yyyy").replace(/DD/g, "dd");
}

/**
 * Replace every `{{date:FORMAT}}` in `template` with `date` (a `YYYY-MM-DD`
 * string) rendered by that date-fns FORMAT; text outside the placeholders is left
 * untouched. `date` is parsed at local midnight so the formatted fields match.
 */
export function renderDailyTemplate(template: string, date: string): string {
  const parsed = new Date(date + "T00:00:00");
  return template.replace(DATE_PLACEHOLDER, (_match, fmt: string) =>
    format(parsed, toDateFnsFormat(fmt)),
  );
}

/**
 * The daily note for `date`: return the existing one if present, otherwise create
 * it from `DAILY_TEMPLATE` with `isDaily`/`dailyDate` set. Idempotent per date.
 */
export async function getOrCreateDaily(db: Db, date: string): Promise<Note> {
  const existing = await notesRepo.findDailyByDate(db, date);
  if (existing) return existing;
  return createNote(db, {
    body: renderDailyTemplate(getEnv().DAILY_TEMPLATE, date),
    isDaily: true,
    dailyDate: date,
  });
}
