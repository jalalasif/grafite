# Codebase map

The real file tree, annotated. Grows per §I.11 as files are created or deleted;
filled from the actual tree in the §III.10 reconciliation pass.

> Update trigger: a new file created or deleted.

## Current tree (Phase 0)

```
docs/
  index.md                      — this doc map
  context/
    app-structure.md            — layers, data model, boundaries
    app-features.md             — capability ledger (BUILT/NOT BUILT)
    design.md                   — design plan + theme architecture
    glossary.md                 — domain vocabulary
  rules/
    conventions.md              — hard rules + decisions taken
    known-bugs.md               — pinned regressions + gotchas
  reference/
    codebase-map.md             — this file
  planning/
    acceptance-grafite.md       — Part IV checklist (architect flips)
```

Application code is added from Phase 1 onward; this map is completed in §III.10.
