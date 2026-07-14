# Codebase map

The real file tree, annotated. Grows per §I.11 as files are created or deleted;
filled from the actual tree in the §III.10 reconciliation pass.

> Update trigger: a new file created or deleted.

## Current tree (through Phase 1)

```
app/
  globals.css                   — Tailwind v4 import + pre-theme baseline
  layout.tsx                    — root layout, <html>/<body>, metadata
  page.tsx                      — placeholder home (superseded later)
docs/                           — living docs (committed; see index.md)
e2e/
  smoke.spec.ts                 — Playwright: app boots & serves the shell
lib/
  env.ts                        — zod env validation (parseEnv/getEnv)
  env.test.ts                   — env unit tests
.github/
  workflows/ci.yml              — quality · test · e2e · build jobs
  workflows/deploy.yml          — CI-status deploy gate (Vercel does the deploy)
  dependabot.yml                — weekly, grouped minor/patch, separate majors
.env.example                    — documented env template
.gitignore  .prettierrc.json  .prettierignore
eslint.config.mjs               — flat config incl. no-colour-literal rule
next.config.ts  postcss.config.mjs  tsconfig.json
vitest.config.ts  vitest.setup.ts  playwright.config.ts
pnpm-workspace.yaml             — pnpm build-allowlist (esbuild, unrs-resolver)
package.json  pnpm-lock.yaml
```

Later phases add `db/`, `services/`, `components/`, `themes/`, more `app/`
routes, and `e2e/` specs. This map is completed from the real tree in §III.10.
