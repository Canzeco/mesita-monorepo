# web-admin — Design system

Calibration map for Mesita’s internal admin console (`admin.mesita.ai`).  
Readers: agents reviewing or building admin UI, and humans doing the same.

## 1. Authority & readers

| Source | Wins for |
| --- | --- |
| `src/app/globals.css` (+ `src/app/layout.tsx` fonts) | Token values (colors, radius, gradients, shadows), font faces |
| **This file** | When-to-use, page templates, component vocabulary, DO/DON’T, debt labels |
| `CLAUDE.md` / `AGENTS.md` | Package law (EF `Result` wrapper, Enricher naming, CI) |
| Product Rules (Notion) | Light theme, no `bg-zinc-900` on app surfaces, place-not-venue, … |

**Rule:** DESIGN.md cites CSS **variable / utility names**, not parallel oklch recipes. If a token changes, update this file in the **same PR**. If a new Save / SectionCard / Error pattern appears, update this file in the same PR or don’t ship the pattern.

This package intentionally uses **Inter** for body UI. Generic “avoid Inter” frontend taste rules do **not** override this file for `apps/web-admin`.

## 2. Voice & principles

- **Calm and dense.** Internal tool: high information density, low ornament.
- **Light theme only.** Semantic tokens (`bg-background`, `bg-card`, `text-foreground`, …). Content stays light; only the sidebar / auth marketing pane invert.
- **Pink is accent, not canvas.** Brand chroma on CTAs, marks, and rare highlights. Canvas / borders / body text keep chroma ≤ ~0.012 (see `globals.css` comment).
- **Don’t invent a fourth lake.** Prefer the canonical path for the page type (below). Existing forks are **debt** — document, don’t copy.

## 3. Page templates + canonical decision tree

Use this first when adding UI:

| Page type | Shell | Card | Save | Error |
| --- | --- | --- | --- | --- |
| **Flat config** (new) | `ConfigPageLayout` → `PageContainer` (default `6xl`) + `PageHeader` | Import `SectionCard` from `enricher-config/atlas-ui.tsx` | `SaveRow` (ink pill) from same | `ErrorNote` (inline) · `AtlasSettingsError` (page load) |
| **Tabbed config** (new) | `PageContainer` + `PageHeader` + `ConfigTabNav` + `mt-6 sm:mt-8` | same as flat config | `SaveRow` | same |
| **Manage / records (single unit)** | `ManageSingleLayoutShell` (full-bleed; no max-width container) | `SectionCard` from `manage-single/ui.tsx` (tinted chip + `shadow-card`) | `SaveBar` (pink gradient + Cancel) | `ErrorNote` · manage ConfirmDialog for destructive |
| **Manage multiple / search** | `PageContainer size="5xl"` + tabs | list / map patterns (not SectionCard) | N/A (actions in rows) | `ErrorNote` or destructive banner |
| **Auth / gate** | `EnterpriseAuthLayout` or centered `bg-hero` + `bg-card shadow-elev rounded-2xl` | — | Google CTA `rounded-full` | `ERROR_BOX_CLASS` |

**Canonical for greenfield config work:** `atlas-ui` `SectionCard` + ink `SaveRow` + shared `ErrorNote`.  
**Do not** start a new Lineup-style `panel-ui` lake outside Lineup/Scoring.

Width cheatsheet: `3xl` (narrow ops), `5xl` (manage-multiple / monitors), `6xl` (default configs), full-bleed (manage-single editor).

## 4. Tokens

Authority: `src/app/globals.css`. Fonts: Inter → `--font-body`, Fraunces → `--font-display` (`layout.tsx`).

### Colors (semantic)

`background` · `foreground` · `card` · `popover` · `primary` · `secondary` · `muted` · `accent` · `destructive` · `border` · `input` · `ring`  
(and matching `*-foreground` where defined)

Tailwind: `bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`, …

### Radius

`--radius` = `0.875rem`; ladder `--radius-sm` … `--radius-3xl`.  
Common: cards `rounded-2xl`, fields `rounded-xl`, CTAs `rounded-full`.

### Gradients & shadows (utilities)

| Utility | Use |
| --- | --- |
| `bg-hero` | Auth / gate empty atmospheres |
| `bg-peacock` | Brand mark chip |
| `bg-pink-gradient` / `text-pink-gradient` | Premium dirty-save CTAs / gradient text |
| `shadow-glow` | Brand mark |
| `shadow-elev` | Elevated shells (map, gate cards, drawer) |
| `shadow-card` | Manage-single / lineup card rest elevation |
| `shadow-save` | Pink-gradient CTA glow |

## 5. Typography (observed)

| Role | Classes (live) |
| --- | --- |
| Page title | `font-display text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl` |
| Card / panel title | `font-display text-base font-semibold tracking-tight` |
| Eyebrow | `text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase` |
| Group label | `text-[11px] font-semibold tracking-[0.12em] uppercase` (manage) · denser `text-[10px]` in lineup |
| Field label | `text-sm font-medium` (config) · `text-[13px] font-medium` (manage filled) |
| Body / help | `text-sm leading-relaxed text-muted-foreground` |
| Dense meta / knobs | `text-[10px]`–`text-[11px]`, often `font-mono tabular-nums` |
| Hero numerals | `font-display text-5xl|text-6xl font-semibold tabular-nums` |

There is no formal type scale beyond these roles — don’t invent one in PRs.

## 6. Component vocabulary

| Name | Path | When to use |
| --- | --- | --- |
| `AppShell` | `src/components/AppShell.tsx` | Authenticated chrome |
| `Sidebar` | `src/components/Sidebar.tsx` | Dark rail (`bg-foreground text-background`) |
| `PageContainer` / `PageHeader` | `src/components/PageContainer.tsx` | Page gutters + title block |
| `ConfigPageLayout` | `src/components/ConfigPageLayout.tsx` | Flat config pages |
| `ConfigTabNav` | `src/components/ConfigTabNav.tsx` | Underline sub-tabs |
| `SectionCard` + `SaveRow` + knobs | `src/app/(app)/enricher-config/atlas-ui.tsx` | **Canonical config** sections/controls |
| `SectionCard` + `SaveBar` + fields | `src/app/(app)/manage-single/ui.tsx` | Unit/records editor only |
| `PanelCard` / `BoxSection` / `BoxSaveBar` | `src/app/(app)/lineup-config/panel-ui.tsx` | Lineup / scoring panels only |
| `ErrorNote` | `src/components/ErrorNote.tsx` | Inline form/section errors |
| `AtlasSettingsError` | `src/components/AtlasSettingsError.tsx` | Full-page Enricher/Atlas load failure |
| `ERROR_BOX_CLASS` | `src/lib/ui-classes.ts` | Auth-only compact error |
| `PlacesMap` | `src/components/PlacesMap.tsx` | Result maps (`rounded-2xl border shadow-elev`) |
| `EnterpriseAuthLayout` / `GoogleSignInButton` | `src/components/auth/*` | Sign-in |

### Controls (config)

Prefer `atlas-ui` primitives: `Switch`, `NumberField`, `TextAreaField`, `QualityPicker`, `Collapsible`, `KnobStatus`.  
Knob enforcement status sits **next to** the control (`KnobStatus`). Switch track is ink/neutral — not pink.

### Controls (manage-single)

Filled inputs (`bg-muted/60 … rounded-xl`), `TextField` / `TextArea` / `SelectField` / `PhoneField` / `ReadField` / `GroupLabel` / `ConfirmDialog` / `Spinner`.

## 7. Interaction state matrix

| State | Expected UI |
| --- | --- |
| Clean (not dirty) | Save disabled (`SaveRow` / `SaveBar`) |
| Dirty | Enable save; manage-single may show Cancel + pink `SaveBar` |
| Pending save | Disable controls; keep save in loading posture |
| Load error | Do **not** enable Save (`SaveRow` honors `loadError`); show `AtlasSettingsError` or `ErrorNote` |
| Action / field error | `ErrorNote` (shared) — don’t fork a local copy |
| Empty list | Muted `text-sm`/`text-xs` in-place (no shared EmptyState yet — debt) |
| Loading | `Spinner` / `Loader2` + `py-10 text-sm text-muted-foreground` |
| Knob not wired / fallback | `KnobStatus` next to control |
| Destructive confirm | `ConfirmDialog` (manage) or explicit danger styling |
| DB reset / hard danger | Raw red (`bg-red-600`, `border-red-200`) — **intentional exception**; don’t spread |

## 8. DO / DON’T

**DO**

- Use semantic tokens and the canonical tree for the page type.
- Keep config cards flat (`rounded-2xl border bg-card`) without inventing new chrome.
- Cite this file in design reviews; fail PRs that invent a fourth Save/SectionCard/Error without updating DESIGN.md.
- Update DESIGN.md in the same PR as token or pattern changes.

**DON’T**

- `bg-zinc-900` / dark app content surfaces (sidebar invert is the exception).
- Rose-wash the whole canvas; pink is accent only.
- Copy manage-single tint chips or `shadow-card` into new config pages.
- Copy `panel-ui` MiniTile/Chip/Slider recipes outside Lineup.
- Hand-edit `AGENTS.md` (regenerate via `deno task sync-rules`).
- Treat debt lakes as equally good for greenfield work.

## 9. Known debt (do not extend)

Three UI lakes coexist. They are **not** three blessed systems — they are unfinished consolidation.

| Lake | Module | Patterns | Status |
| --- | --- | --- | --- |
| Config | `enricher-config/atlas-ui.tsx` | `SectionCard` (no shadow) · ink `SaveRow` | **Canonical for new config** |
| Manage | `manage-single/ui.tsx` | tinted `SectionCard` + `shadow-card` · pink `SaveBar` | Keep for records editor; don’t export into config |
| Lineup | `lineup-config/panel-ui.tsx` | `PanelCard` / `BoxSection` · `BoxSaveBar` | Lineup-only; don’t start lake #4 |

Also debt: no shared `EmptyState` / `Button` / `Input`; uneven `shadow-card` on config cards; scattered raw `bg-red-*` / tint chip hues outside semantic tokens; local `ErrorNote` leftovers in a few pages.

**Follow-up (TODOS):** extract a shared admin UI kit, then shrink this section to a pointer.
