# Grafite

A single-user, self-hosted note-taking web app: Obsidian's mechanics (markdown,
wikilinks, backlinks, nested tags) with Bear's visual restraint. It is built to be
read from and written in daily — book notes with screenshots, and journal
entries — and it deploys to Vercel on Neon Postgres and Vercel Blob.

> **Build status.** The domain, data, and service layers are complete and fully
> tested, along with authentication and the theme system. The main authenticated
> UI (editor, sidebar, note list, command palette) and the JSON API routes over
> the services are **not yet built** — see `docs/` and the build report. `docs/`
> is committed and is the source of truth for design intent and conventions.

## Local setup

```bash
git clone <this repo> && cd grafite
pnpm install                 # Node 22+, pnpm (via corepack)
cp .env.example .env         # then fill in the values below
pnpm db:push                 # apply the schema to your database
pnpm dev                     # http://localhost:3000
```

### Environment (`.env`)

All variables are validated at startup by `lib/env.ts` — the app fails loudly at
boot if any required one is missing or malformed.

| Var                     | What                                              |
| ----------------------- | ------------------------------------------------- |
| `DATABASE_URL`          | Neon **pooled** connection string                 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (images)                        |
| `AUTH_PASSWORD_HASH`    | bcrypt hash of your login password                |
| `AUTH_SECRET`           | 32+ random bytes, base64, for JWT signing         |
| `TZ`                    | daily-note date resolution (default `Asia/Dhaka`) |
| `DAILY_TEMPLATE`        | optional; default `# {{date:YYYY-MM-DD}}\n\n`     |

**Generate the password hash** (never store the plaintext):

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'your-password'
```

**Generate `AUTH_SECRET`:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Deploy

Connect the repo to Vercel, add the **Neon** integration and a **Blob** store,
then set the env vars above in the Vercel project. Push to `main`: CI runs, and
Vercel deploys on green. Enable Vercel's "only deploy when checks pass" so a red
CI never ships (`.github/workflows/deploy.yml` also gates on CI status).

## Scripts

| Script                                        | Does                                                          |
| --------------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`                | Next dev / production build / serve                           |
| `pnpm typecheck`                              | `tsc --noEmit`                                                |
| `pnpm lint`                                   | ESLint, `--max-warnings 0` (incl. the no-colour-literal rule) |
| `pnpm format` / `format:check`                | Prettier write / check                                        |
| `pnpm test`                                   | all Vitest tests                                              |
| `pnpm test:unit` / `test:integration`         | the unit / integration project                                |
| `pnpm test:coverage`                          | both projects with coverage floors enforced                   |
| `pnpm test:e2e`                               | Playwright (Chromium)                                         |
| `pnpm db:generate` / `db:migrate` / `db:push` | Drizzle Kit                                                   |

## Architecture

Layers import downward only:

```
app/            — routes, pages, API handlers (Next.js App Router)
  ↓
components/     — React components
  ↓
services/       — business logic; orchestrates repositories
  ↓
db/repositories/— data access; the only place Drizzle queries live
  ↓
db/schema.ts    — Drizzle table definitions
  ↓
lib/            — pure functions, zero framework imports
```

`lib/` is pure TypeScript over plain data (100% test-covered): the wikilink and
tag parsers, slug/title derivation, the markdown pipeline, WCAG contrast math.
Repositories return domain types, never Drizzle rows. The `themes/` system
(Amendment 1) sits at `lib/`'s purity level — light and dark are modes _within_ a
theme, emitted as CSS custom properties and switched at runtime with no flash.

## The escape hatch

Your notes are never trapped in Postgres. **Export the whole vault** and you get
a zip that is a valid **Obsidian vault**: one `.md` per note with YAML
frontmatter, folders derived from your tag tree, images alongside in `assets/`,
and wikilinks preserved verbatim. Unzip it, open the folder in Obsidian, and
everything — including the links — works. That round-trip is why backing Grafite
with Postgres was a safe decision: the data model is a superset of plain files,
and you can walk away with plain files at any time.
