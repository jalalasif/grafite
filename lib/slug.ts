/**
 * Slug generation (§II.5.4). Pure — no framework, no I/O.
 *
 * Slugs are **immutable** once assigned (conventions.md #1): renaming a note's
 * title must never change its slug, or every wikilink pointing at it breaks.
 * That immutability is enforced by the caller (the note repository assigns a
 * slug once); this module only produces candidates.
 */

const MAX_LENGTH = 80;

/**
 * Turn a title into a kebab-case slug: lowercase, spaces→`-`, transliterate
 * diacritics where sensible (`café`→`cafe`), drop anything else, collapse
 * repeated dashes, trim edge dashes, cap at 80 chars. Empty result → `untitled`.
 */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "") // strip combining/diacritical marks
    .toLowerCase()
    .replace(/\s+/g, "-") // spaces (only) become dashes
    .replace(/[^a-z0-9-]/g, "") // strip everything not slug-legal
    .replace(/-+/g, "-") // collapse repeated dashes
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes

  // Cap length *before* any collision suffix, and never leave the cut on a dash.
  const capped = base.slice(0, MAX_LENGTH).replace(/-+$/g, "");
  return capped || "untitled";
}

/**
 * Resolve a slug collision: return `base` if free, else `base-2`, `base-3`, …
 * until `exists` reports the candidate is free. `exists` is injected so this
 * stays pure (the DB lives behind it).
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}
