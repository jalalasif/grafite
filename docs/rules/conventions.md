# Conventions & invariants

Hard rules that constrain every change, plus decisions taken under ambiguity
(§I.2). Seeded from the rules the spec already states; grows as the build proceeds.

## Invariants (from the spec)

1. **Slugs are immutable.** A slug is assigned at note creation and frozen.
   Renaming a note's title never changes its slug — that would break every wikilink
   pointing at it. (§II.5.4)
2. **`lib/` imports no framework.** No React, Next, or database imports anywhere in
   `lib/`. Pure TypeScript over plain data. Same purity applies to `themes/`.
   (§II.4)
3. **Tag ancestors are not denormalised.** A note gets a `note_tags` row for the
   **leaf tag only**; ancestor rollup is a query-time recursive CTE. Two sources of
   truth would drift. (§II.2)
4. **Repositories return domain types, not Drizzle rows.** Mapping happens at the
   repository boundary; services never see a Drizzle type. (§II.4)
5. **The database is never mocked in tests.** Repository/service tests run against a
   real Postgres (pglite). A mocked repository test asserts the mock behaves like
   the mock. (§II.10)
6. **Layers import downward only.** `app → components → services → repositories →
   schema → lib`. Never upward. (§II.4)
7. **Every API route validates input with zod at the boundary** and returns the
   consistent error shape `{ error: { code, message, details? } }`. (§II.7)
8. **The PATCH cascade runs in one transaction** and includes link-healing. (§II.7)
9. **One live daily note per date; soft-deleted notes don't squat on slugs.**
   Enforced by partial unique indexes, not inline uniques. (§II.2)
10. **TDD, no exceptions.** No production code without a failing test demanding it,
    except the exempt set (pure config, type-only decls, the Drizzle schema file,
    generated migrations). (§I.5)
11. **Transclusion is one level deep.** A transcluded note's transclusions render
    as plain links; this bounds recursion without cycle detection. (§II.5.1)
12. **Import never destroys.** A slug collision on import creates a new suffixed
    note; it never overwrites. (§II.6.7)
13. **Autosave is IndexedDB-first**, then POST. The draft buffer clears `dirty` only
    on POST success. (§II.8)

## Theme conventions (Amendment 1)

14. **No colour literals in `components/**` or `app/**`.** No hex, `rgb(`, or
    `hsl(`. Colours come only from CSS custom properties emitted from a theme
    mode. Enforced by an ESLint `no-restricted-syntax` rule that fails the build.
15. **Light/dark are modes within a theme, not separate themes.** The `Theme` type
    makes a single-mode theme unrepresentable (`modes.light` and `modes.dark` are
    both required).
16. **Every theme must clear WCAG AA 4.5:1** for text/bg and accent/bg in both
    modes — enforced by a test using `lib/contrast.ts`.
17. **The accent is a mark, never a fill.** It appears only as ≤2px marks, link
    underlines, the caret, and focus rings (design self-critique revision).
18. **Adding a theme = one file in `themes/` + one line in `themes/registry.ts`.**

## Decisions taken under ambiguity (§I.2)

> Each entry: the fork the spec left open, the option chosen (the more reversible
> one), and why.

- **DT-1 — Branch name.** Repo initialised on `master`; spec targets `main` for
  CI/deploy. Renamed the working branch to `main`. Reversible (`git branch -m`).
- **DT-2 — Package manager bootstrap.** `pnpm` was not installed; enabled via
  Node 22's `corepack`. No effect on the committed lockfile.
- **DT-3 — `frontend-design` skill absent.** The §II.9-referenced skill file does
  not exist in this environment. Design plan reasoned directly from the brief;
  recorded in `design.md`.
- **DT-4 — Integration DB engine.** (Recorded in III.3 — pglite vs Docker Postgres,
  decided after verifying `tsvector` generated-column support.)
- **DT-5 — Blob/Neon credentials absent.** Both external services are mocked behind
  an interface for tests; real adapters call the SDKs. Listed in the final report's
  NOT DONE / OWED VERIFICATION.

## Borrowed conventions (§I.13)

- Wikilink / unresolved-link / broken-link styling follows **Obsidian**'s
  convention (distinct class for broken links).
- Nested-tag hierarchy and directory-as-tag import follow **Obsidian**'s vault
  layout, so exports round-trip.
