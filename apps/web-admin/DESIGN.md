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
- **One kit root.** Import from `@/components/admin-ui` (or `/config` · `/manage` · `/lineup`). Route-local `atlas-ui` / `manage-single/ui` / `panel-ui` are thin re-export shims — don’t grow them.
- **Don’t invent a fourth lake.** Prefer the canonical path for the page type (below).

## 3. Page templates + canonical decision tree

Use this first when adding UI. **Kit root:** `@/components/admin-ui`.

| Page type | Shell | Card | Save | Error |
| --- | --- | --- | --- | --- |
| **Flat config** (new) | `ConfigPageLayout` → `PageContainer` (default `6xl`) + `PageHeader` | `SectionCard` from `@/components/admin-ui` (or `/config`) | `SaveRow` (ink pill) | `ErrorNote` · `AtlasSettingsError` |
| **Tabbed config** (new) | `PageContainer` + `PageHeader` + `ConfigTabNav` + `mt-6 sm:mt-8` | same | `SaveRow` | same |
| **Manage / records (single unit)** | `ManageSingleLayoutShell` (full-bleed) | `ManageSectionCard` / manage `SectionCard` (tinted chip + `shadow-card`) from `/manage` | `SaveBar` (pink + Cancel) | `ErrorNote` · `ConfirmDialog` |
| **Manage multiple / search** | `PageContainer size="5xl"` + tabs | list / map patterns (not SectionCard) | N/A | `ErrorNote` or destructive banner |
| **Auth / gate** | `EnterpriseAuthLayout` or centered `bg-hero` + `bg-card shadow-elev rounded-2xl` | — | Google CTA `rounded-full` | `ERROR_BOX_CLASS` |
| **Lineup / scoring** | scoring shells | `PanelCard` / `BoxSection` from `/lineup` | `BoxSaveBar` | inline error in `BoxSaveBar` |

**Canonical for greenfield config:** `SectionCard` + ink `SaveRow` + `ErrorNote` from `@/components/admin-ui`.  
**Do not** use lineup MiniTile/Chip/Slider outside Lineup/Scoring.

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
| `bg-brand` | Brand mark chip |
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
| **Admin UI kit** | `src/components/admin-ui/` | **One import root** — `index` · `config` · `manage` · `lineup` |
| `AppShell` | `src/components/AppShell.tsx` | Authenticated chrome |
| `Sidebar` | `src/components/Sidebar.tsx` | Dark rail (`bg-foreground text-background`) |
| `PageContainer` / `PageHeader` | `src/components/PageContainer.tsx` | Page gutters + title block |
| `ConfigPageLayout` | `src/components/ConfigPageLayout.tsx` | Flat config pages |
| `ConfigTabNav` | `src/components/ConfigTabNav.tsx` | Underline sub-tabs |
| `SectionCard` + `SaveRow` + knobs | `admin-ui/config.tsx` | **Canonical config** |
| `ManageSectionCard` + `SaveBar` + fields | `admin-ui/manage.tsx` | Unit/records editor only |
| `PanelCard` / `BoxSection` / `BoxSaveBar` | `admin-ui/lineup.tsx` | Lineup / scoring only |
| `ErrorNote` / `AtlasSettingsError` / `ERROR_BOX_CLASS` | re-exported from kit barrel | Errors |
| `PlacesMap` | `src/components/PlacesMap.tsx` | Result maps |
| `EnterpriseAuthLayout` / `GoogleSignInButton` | `src/components/auth/*` | Sign-in |
| Legacy shims | `enricher-config/atlas-ui`, `manage-single/ui`, `lineup-config/panel-ui` | Re-exports only (+ `CrossTabLink` in manage-single/ui) |

### Controls (config)

`Switch`, `NumberField`, `TextAreaField`, `QualityPicker`, `Collapsible`, `KnobStatus` from `admin-ui/config`.  
Knob enforcement sits **next to** the control. Switch track is ink/neutral — not pink.

### Controls (manage)

Filled inputs (`bg-muted/60 … rounded-xl`), `TextField` / `TextArea` / `SelectField` / `PhoneField` / `ReadField` / `GroupLabel` / `ConfirmDialog` / `Spinner` from `admin-ui/manage`.

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
- Copy manage tint chips or `shadow-card` into new config pages.
- Copy lineup MiniTile/Chip/Slider recipes outside Lineup.
- Hand-edit `AGENTS.md` (regenerate via `deno task sync-rules`).
- Grow the legacy route-local shim files — add chrome in `admin-ui/` instead.

## 9. Surface variants (one kit, three skins)

Implementation is centralized under `src/components/admin-ui/`. Visual variants remain on purpose:

| Surface | Module | Patterns | New work |
| --- | --- | --- | --- |
| Config | `admin-ui/config.tsx` | `SectionCard` (no shadow) · ink `SaveRow` | **Default** |
| Manage | `admin-ui/manage.tsx` | tinted card + `shadow-card` · pink `SaveBar` | Records editor only |
| Lineup | `admin-ui/lineup.tsx` | `PanelCard` / `BoxSection` · `BoxSaveBar` | Scoring only |

Remaining debt: no shared `EmptyState` / `Button` / `Input`; uneven tint chips vs semantic tokens; local `ErrorNote` leftovers in a few pages; callers still import via legacy shims (migrate opportunistically to `@/components/admin-ui`).
