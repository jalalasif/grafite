# App features — capability ledger

Every feature from §II.6 (and the cross-cutting capabilities) as a row. A row
flips **NOT BUILT → BUILT** only in the commit that ships it with real evidence
behind it (§III.10 step 5).

| #   | Capability                                                                | §              | Status    |
| --- | ------------------------------------------------------------------------- | -------------- | --------- |
| 1   | Editor: live-preview markdown (syntax hides outside cursor node)          | II.6.1         | NOT BUILT |
| 2   | Editor: headings/bold/italic/strike/code/links/lists render live          | II.6.1         | NOT BUILT |
| 3   | Editor: fenced code blocks highlighted, marks hidden                      | II.6.1         | NOT BUILT |
| 4   | Editor: `[[` wikilink autocomplete (fuzzy, ↑↓↵Esc)                        | II.6.1         | NOT BUILT |
| 5   | Editor: `#` tag autocomplete                                              | II.6.1         | NOT BUILT |
| 6   | Editor: paste image → upload → `![[...]]`, placeholder, retry             | II.6.1         | NOT BUILT |
| 7   | Editor: drag image → same path                                            | II.6.1         | NOT BUILT |
| 8   | Editor: keymap ⌘B/⌘I/⌘K/⌘⇧K/⌘⏎                                            | II.6.1         | NOT BUILT |
| 9   | Editor: autosave (debounce 800ms + blur + route change), IDB-first        | II.6.1/II.8    | NOT BUILT |
| 10  | Sidebar: collapsible nested tag tree + All notes root                     | II.6.2         | NOT BUILT |
| 11  | Note list: title/preview/relative-time, sort options                      | II.6.2         | NOT BUILT |
| 12  | Search: FTS, ranked, `ts_headline` snippets, debounce+abort               | II.6.3         | NOT BUILT |
| 13  | Search: `tag:` and `is:daily` query prefixes                              | II.6.3         | NOT BUILT |
| 14  | Backlinks panel + unlinked mentions                                       | II.6.4         | NOT BUILT |
| 15  | Daily notes: ⌘D get-or-create, template, TZ-correct date, picker          | II.6.5         | NOT BUILT |
| 16  | Command palette ⌘K, `>` command mode                                      | II.6.6         | NOT BUILT |
| 17  | Import: md / multi-md / zip, dirs→tags, 2-pass links, preview, no-destroy | II.6.7         | NOT BUILT |
| 18  | Export: single md (frontmatter)                                           | II.6.8         | NOT BUILT |
| 19  | Export: single PDF via print route                                        | II.6.8         | NOT BUILT |
| 20  | Export: vault zip (valid Obsidian vault)                                  | II.6.8         | NOT BUILT |
| 21  | Trash: soft delete, list, restore, permanent delete (+Blob purge)         | II.6.9         | NOT BUILT |
| 22  | Local-first draft buffer (IndexedDB), conflict prompt, reconnect flush    | II.8           | NOT BUILT |
| 23  | Auth: single password, JWT cookie, middleware, rate limit                 | II.3           | NOT BUILT |
| 24  | Theme system: modular, runtime-switchable, light/dark modes, FOUC-free    | Amendment      | NOT BUILT |
| 25  | Design tokens as CSS custom properties, no hex in components              | II.9/Amendment | NOT BUILT |

## Domain logic (`lib/`) — the pure foundation

| Module                | §         | Status    |
| --------------------- | --------- | --------- |
| `lib/slug.ts`         | II.5.4    | BUILT     |
| `lib/title.ts`        | II.5.3    | BUILT     |
| `lib/tags.ts`         | II.5.2    | BUILT     |
| `lib/wikilinks.ts`    | II.5.1    | BUILT     |
| `lib/code-scan.ts`    | II.5.1/2  | BUILT     |
| `lib/search-query.ts` | II.6.3    | BUILT     |
| `lib/frontmatter.ts`  | II.5.6    | NOT BUILT |
| `lib/markdown.ts`     | II.5.5    | NOT BUILT |
| `lib/contrast.ts`     | Amendment | BUILT     |
| `lib/env.ts`          | II.12     | BUILT     |
