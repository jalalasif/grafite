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
- **DT-4 — Integration DB engine = pglite.** Verified before committing that
  pglite (in-process Postgres, PG16 base) applies the whole schema and handles
  the **generated `tsvector` column** (populated; `ts_rank_cd`/`websearch_to_tsquery`
  work), the **partial unique indexes** (soft-deleted slug reusable), and the
  **check constraint** (rejects `is_daily` without a date). No Docker/service
  container needed for CI (§II.10). Tests migrate from the committed migration
  files and roll each test back in a transaction.
- **DT-9 — Tag descendant rollup via prefix, not a recursive CTE.** Since tag
  names are materialised full paths, `noteIdsUnderPath` matches `name = path OR
left(name, len+1) = path||'/'` instead of a `parent_id` recursive CTE.
  Equivalent given materialised names, `_`/`%`-safe (unlike LIKE), and avoids a
  raw CTE's driver-specific result shape. (§II.6.2 suggested a CTE.)
- **DT-10 — Repositories are driver-agnostic via `PgDatabase`.** The `Db` type
  (db/client.ts) is the base `PgDatabase`, which Neon-HTTP, pglite, and a
  transaction all satisfy — so the same repository code runs in prod, in tests,
  and inside the PATCH-cascade transaction. Vitest resolves the `@/` path alias
  via `resolve.alias` (added per-project in vitest.config.ts).
- **DT-5 — Blob/Neon credentials absent.** Both external services are mocked behind
  an interface for tests; real adapters call the SDKs. Listed in the final report's
  NOT DONE / OWED VERIFICATION.
- **DT-6 — Coverage denominator.** §II.10's "Overall 80%" floor is scoped to the
  unit/integration-testable core (`lib`, `services`, `db/repositories`, `themes`),
  not the whole tree. UI surfaces are covered by Playwright (§II.10), which a
  unit-coverage tool cannot measure; including them would make the denominator
  meaningless. `vitest.config.ts` `coverage.include` encodes this. More reversible
  than the alternative (a second coverage tool wired into E2E).
- **DT-7 — Coverage gate script.** §II.11 lists the coverage step as
  `pnpm test:unit (vitest run --coverage)` plus a separate `pnpm test:integration`.
  Implemented instead as `pnpm test:coverage` (`vitest run --coverage`, runs **both**
  projects) so the services/repositories floors are enforced in one merged report;
  `test:unit`/`test:integration` remain as focused developer scripts. Same intent,
  no double-run.
- **DT-8 — ESLint stack.** `eslint-config-next` 15.5 is eslintrc-only and its
  plugins are not hoisted under pnpm, so it cannot be consumed cleanly in flat
  config without `@eslint/eslintrc`. Replaced with a flat config composing
  `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and
  `@next/eslint-plugin-next` directly. TypeScript pinned to `5.9.x` (the native
  TS 7 port and TS 6 violate `typescript-eslint`'s `<6.1.0` peer range).

## Borrowed conventions (§I.13)

- Wikilink / unresolved-link / broken-link styling follows **Obsidian**'s
  convention (distinct class for broken links).
- Nested-tag hierarchy and directory-as-tag import follow **Obsidian**'s vault
  layout, so exports round-trip.
- A tag must contain at least one ASCII letter, so `#404` is **not** a tag —
  **Obsidian**'s rule (the spec was silent on numeric-only tags).
- A tag's leading boundary is start-of-text or whitespace; this excludes URL
  fragments (`…/page#anchor`) and `a#b`, satisfying the §II.5.2 URL rule cleanly.
- Tag bodies are matched as ASCII `[A-Za-z0-9_/-]`; non-ASCII letters are not
  part of a tag body (keeps tag paths storage-clean; spec listed the char set
  explicitly).

## Markdown pipeline (lib/markdown.ts)

- The wikilink/tag "custom remark plugins" (§II.5.5) are implemented as
  `text`-node visitors. remark keeps `[[…]]`/`#tag`/`![[…]]` as single text
  nodes and code as separate `code`/`inlineCode` nodes, so code exclusion is
  automatic and positions stay accurate.
- **shiki runs after rehype-sanitize** (the spec's pipeline order): sanitize
  strips dangerous user HTML first, then shiki adds its inline token styles,
  which therefore survive. Raw HTML in the body is dropped by remark-rehype
  itself (no `allowDangerousHtml`); sanitize is defence-in-depth. Single theme
  (`github-light`) for now — dual-theme code colours are a UI-phase polish.
- **Transclusion** re-renders the target body through a sub-processor with
  transclusion disabled, so a nested `![[…]]` degrades to a link and cycles
  terminate (one level deep, §II.5.1).
- **Added dependencies** (beyond §II.1, justified per §II.1): `unist-util-visit`
  (runtime) to author the mandated remark plugins; `@types/mdast`, `@types/hast`,
  `@types/unist` (dev) for their node types. All are core unified-ecosystem
  packages the mandated pipeline implies.

## Code-region scanning (lib/code-scan.ts)

- Shared by the wikilink and tag parsers so "not parsed inside code" has one
  source of truth (§I.12). Simplifications: a fence is a line starting with 3+
  backticks/tildes and closes on the same fence character; inline code is
  matched within a single line (an opening run of N backticks closes on the
  next run of exactly N; an unmatched run is literal).
