# Design plan

> Written **before** any component (§II.9). Palette, type, layout, signature —
> then critiqued against the AI-default tell, revised, and only then built to.
>
> The `frontend-design` skill referenced in §II.9 is **not present** in this build
> environment (`/mnt/skills/public/frontend-design/SKILL.md` does not exist). This
> plan is reasoned from the brief directly; noted under DECISIONS TAKEN.

## The brief, restated

Bear's restraint, for a reader of books and a keeper of journals — someone reading
Calvino at night and writing about it. Generous whitespace, a single warm accent
used **sparingly**, typography that treats prose as the subject rather than the
chrome, separation by space rather than lines. Light and dark, both *designed*.
Responsive to 380px. Keyboard-first, so focus states are core UX. **One** signature
element; spend boldness once.

## Concept: graphite on paper

The name *Grafite* is graphite — the pencil. The identity is pencil-on-paper: calm
neutral graphite greys carrying the chrome, warm paper as the ground, and a single
**signal** accent that behaves like a margin mark a reader leaves in a book. The
accent is not decoration sprayed across the UI; it is the one red-pencil stroke.

## Palette (4–6 named values per mode)

Colours are *intent* here; the exact hex are tuned in `themes/grafite.ts` so every
pair clears **WCAG AA 4.5:1** (enforced by `lib/contrast.ts` + a test). Final tuned
values are reconciled back into this doc in §III.10.

### Light mode — "paper"
| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#F5F4F1` | warm-neutral paper ground (cooler & greyer than the cream tell) |
| `--color-surface` | `#FFFFFF` | raised inputs / popovers |
| `--color-text` | `#1C1E22` | graphite near-black body ink |
| `--color-text-muted` | `#5E6369` | secondary text, timestamps |
| `--color-border` | `#E4E2DD` | hairlines used rarely; separation is mostly space |
| `--color-accent` | `#B23A2E` | signal rust — the margin mark; ≥4.5:1 on bg |

### Dark mode — "graphite" (designed, not inverted)
| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#17191D` | deep cool graphite, not pure black |
| `--color-surface` | `#20242A` | raised inputs / popovers |
| `--color-text` | `#E6E3DD` | warm off-white ink |
| `--color-text-muted` | `#9AA0A7` | secondary |
| `--color-border` | `#2B2F36` | hairlines |
| `--color-accent` | `#E8795E` | lifted, slightly warmer signal — the white-mode rust would go muddy on near-black; ≥4.5:1 on bg |

The accent is intentionally a **deeper rust**, not terracotta `#D97757`, and it
lifts + warms in dark mode rather than being reused verbatim.

## Type — prose is the product

| Role | Stack | Use |
|---|---|---|
| `--font-reading` | `Charter, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif` | note body + rendered content — a calm humanist book serif, **low contrast**, not a display face |
| `--font-ui` | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | chrome: sidebar, lists, palette, buttons |
| `--font-mono` | `ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace` | code spans/blocks |

- Reading measure **~68ch**, body line-height **1.65**.
- Type scale (rem): `0.8125 · 0.875 · 1 · 1.125 · 1.375 · 1.75 · 2.25`. An H1 feels
  like a *title* through size **and weight**, not a contrasty display cut.
- No web-font network dependency (avoids FOUC + a dep); high-quality system/web-safe
  stacks per role. A theme *may* override fonts (the `Theme.fonts` field).

## Layout

Three calm columns, no visible column rules — separation by background-tone shift
and whitespace:

1. **Sidebar** (collapsible, `localStorage`-persisted): nested tag tree + "All
   notes" root.
2. **Note list**: title · ~80-char preview · relative time. Comfortable Bear-like
   density.
3. **Editor**: the hero. ~68ch reading measure centred in generous whitespace.

Below the editor: the backlinks panel. Command palette (⌘K) floats centred over a
dimmed ground. At ≤380px the columns collapse to a single stack with the editor
foregrounded.

## The signature — the margin mark

Boldness is spent **once**: the active note in the list carries a solid accent
**left-margin tick** (2px), exactly like a pencil mark beside a paragraph in a
book. The editor caret is accent-coloured. Wikilinks are underlined with a thin
accent underline that thickens on hover (a pencil underline); unresolved links use
a dotted accent underline. Nothing else uses the accent as a fill. Everything else
stays greyscale and quiet.

## Self-critique (required by §II.9)

**Is any part the generic AI default?**
- Background: the tell is cream `#F4F1EA`. Ours is `#F5F4F1` — deliberately cooler
  and greyer, a graphite-paper not a manila-cream. Borderline in hex distance, so
  the *revision* below leans further from cream and relies on space over fills.
- Accent: the tell is terracotta `#D97757`. Ours is a deeper, redder rust `#B23A2E`
  and — critically — it is used *sparingly* as a 2px mark, never as button/section
  fills. Usage, not just hue, separates it from the default.
- Serif: the tell is a *high-contrast serif display*. Ours is a **low-contrast
  humanist body serif** used for reading, with headings scaled by weight, not by a
  display cut. This is the opposite move from the tell.

**Revision after critique:**
1. Push the light ground a touch greyer/cooler and keep large surfaces
   `--color-surface` white so the "paper" reads as paper, not cream — reduce any
   manila cast.
2. Forbid accent fills in the enforced rule set: the accent appears only as
   ≤2px marks, link underlines, the caret, and focus rings. Written into
   `conventions.md`.
3. Headings share `--font-reading`; hierarchy comes from the weight/size scale, so
   no second "display" typeface is introduced.

Built to the **revised** plan.

---

## Theme architecture (Amendment 1 — takes precedence over §II.9)

Themes are modular and **runtime-switchable**. Light and dark are **modes within a
theme**, never separate themes — the type makes a single-mode theme
unrepresentable.

### Files
- `themes/types.ts` — the `Theme` interface: `id`, `name`, `modes.light`,
  `modes.dark`, `fonts`. A `ThemeMode` is a flat record of token → value.
- `themes/registry.ts` — exports a `THEMES` record keyed by theme id, plus helpers.
- `themes/grafite.ts` — the default theme designed above.
- `themes/_template.ts` — a commented skeleton; copy it to add a theme.

### Token emission
Each mode is a flat map of token name → CSS value. At runtime the active mode's
tokens are written as **CSS custom properties onto `:root`**. Theme + mode are
selected by `data-theme` and `data-mode` attributes on `<html>`.

### Persistence & FOUC
Choice persists in `localStorage` (`grafite.theme`, `grafite.mode`). An **inline
script in `<head>`** runs before first paint: it reads the stored theme/mode (or
falls back to `prefers-color-scheme` for mode), stamps `data-theme`/`data-mode` on
`<html>`, and writes the token custom properties — so there is no flash of the
wrong theme.

### Enforcement (all three are real, failing the build if violated)
1. **ESLint** `no-restricted-syntax` rule failing on any hex, `rgb(`, or `hsl(`
   literal in `components/**` or `app/**`. Colours come only from tokens.
2. A **test** asserting every registered theme satisfies the `Theme` interface in
   **both** modes (every required token present, non-empty).
3. A **test** asserting every theme clears WCAG AA **4.5:1** for text/bg and
   accent/bg in **both** modes, using the pure `lib/contrast.ts` (itself unit
   tested against known WCAG reference pairs).

### Adding a theme
One new file in `themes/` + one line in `themes/registry.ts`. Nothing else.
