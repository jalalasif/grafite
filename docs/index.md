# Grafite — Documentation Map

Grafite is a single-user, self-hosted note-taking web app: Obsidian's mechanics
(markdown, wikilinks, backlinks, nested tags) with Bear's visual restraint.

These docs are written **doc-first**: the design was committed to paper before the
code was written, so the code could be held to it. At the end of the build a
reconciliation pass (§III.10) corrects whichever of code/doc is wrong — the code
wins on facts, the doc wins on intent.

> **Departure from the usual blueprint.** In the architect's normal workflow
> `docs/` is gitignored local working memory. Here `docs/` is **committed** to the
> repo, so a future session on a fresh clone inherits the design intent and the
> rules. This is deliberate.

## The tree

| Path | What it holds | Update trigger |
|---|---|---|
| `context/app-structure.md` | Layer architecture + data model + why each boundary exists | A structural/architectural shift |
| `context/app-features.md` | Capability ledger; every feature as a row, BUILT / NOT BUILT | A feature/capability shipped |
| `context/design.md` | The design plan: palette, type, layout, signature, theme architecture | Visual/design change |
| `context/glossary.md` | Domain terms | A new domain term reused across the codebase |
| `rules/conventions.md` | Hard rules and invariants; decisions taken under ambiguity | A new hard rule / invariant / resolved ambiguity |
| `rules/known-bugs.md` | Gotchas, discrepancies, workarounds, pinned regressions | A new gotcha / bug fixed |
| `reference/codebase-map.md` | The real file tree, annotated | A file created or deleted |
| `planning/acceptance-grafite.md` | Part IV acceptance checklist; the architect flips these, not Claude | Never flipped by Claude |

## Reading order for a returning session

1. `context/glossary.md` — the vocabulary.
2. `context/app-structure.md` — the shape.
3. `rules/conventions.md` — the rules that constrain every change.
4. `context/app-features.md` — what exists.
5. `reference/codebase-map.md` — where it lives.
