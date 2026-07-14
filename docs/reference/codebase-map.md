# Codebase map

The real file tree, annotated (filled in the §III.10 reconciliation pass from the
actual tree). Test files (`*.test.ts[x]`, `e2e/*.spec.ts`) sit beside the code
they cover and are omitted below for brevity.

> Update trigger: a new file created or deleted.

```
lib/                        — pure domain logic, no framework, 100% covered
  slug.ts                   — slugify + uniqueSlug (collision walk)
  title.ts                  — deriveTitle (H1 > first line > Untitled)
  tags.ts                   — parseTags, normaliseTagPath, expandTagAncestors
  wikilinks.ts              — parseWikilinks / replaceWikilinks (byte-accurate)
  code-scan.ts              — maskCode: shared code-region masking
  search-query.ts           — parseSearchQuery (tag:, is:daily)
  frontmatter.ts            — parse/serialise YAML frontmatter (hand-rolled)
  markdown.ts               — remark→rehype pipeline (wikilinks, tags, sanitize, shiki)
  contrast.ts               — WCAG luminance/ratio/AA (Amendment 1)
  env.ts                    — zod env validation (parseEnv/getEnv)

db/
  schema.ts                 — Drizzle tables (§II.2)
  client.ts                 — Db type + getDb() (Neon HTTP)
  testing.ts                — pglite harness: createTestDb + withRollback
  migrations/0000_init.sql  — generated migration (committed)
  repositories/
    types.ts                — domain types (Note, Tag, Asset, Link, …)
    notes.ts                — notesRepo
    tags.ts                 — tagsRepo (materialise, prune, descendant rollup)
    links.ts                — linksRepo (replace, backlinks, heal)
    assets.ts               — assetsRepo

services/                   — business logic over repositories
  note-sync.ts              — PATCH cascade + link healing (one transaction)
  search.ts                 — FTS + scoping
  daily.ts                  — TZ-correct daily notes + template
  import.ts                 — vault import (dirs→tags, 2-pass links, images)
  export.ts                 — single-note md + vault zip
  blob.ts                   — BlobGateway interface + in-memory impl
  blob-vercel.ts            — real Vercel Blob adapter (boundary, uncovered)
  auth.ts                   — verifyPassword, session JWT, rate limiter

themes/                     — modular theme system (Amendment 1)
  types.ts                  — Theme interface (both modes required)
  grafite.ts                — default theme (AA-clearing palette)
  registry.ts               — THEMES record + helpers
  _template.ts              — commented skeleton (copy to add a theme)
  tokens.ts                 — CSS-var emission + FOUC inline script

components/theme/
  ThemeProvider.tsx         — runtime theme/mode state, persistence
  ThemeToggle.tsx           — light/dark toggle

app/                        — Next App Router
  layout.tsx                — head: theme stylesheet + FOUC script; ThemeProvider
  globals.css               — base styling from tokens; focus/reduced-motion
  page.tsx                  — placeholder home (main UI NOT built)
  login/page.tsx            — login form + theme toggle
  api/_response.ts          — jsonError/jsonOk (consistent error shape §II.7)
  api/auth/login/route.ts   — POST login (rate-limit, bcrypt, cookie)
  api/auth/logout/route.ts  — POST logout (clear cookie)

middleware.ts               — Edge auth gate
drizzle.config.ts  next.config.ts  postcss.config.mjs  tsconfig.json
eslint.config.mjs  vitest.config.ts  vitest.setup.ts  playwright.config.ts
.github/workflows/{ci,deploy}.yml  .github/dependabot.yml
```

## Not yet in the tree (see the build report)

`app/api/` note/tag/asset/import/export/search/daily routes; the main authed UI
(sidebar, tag tree, note list, command palette); the CodeMirror editor and its
IndexedDB draft buffer; the import/export/trash UI. The **services and
repositories these would call already exist and are tested** — what is missing is
the HTTP and React surface over them.
