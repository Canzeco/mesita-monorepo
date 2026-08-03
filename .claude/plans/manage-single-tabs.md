# Manage Single Unit — 4 tabs → 5

Admin console, `apps/web-admin/src/app/(app)/manage-single/`.

**Today:** Place · Promos · Scores · Team. The Place tab carries a completeness
banner plus an 11-card masonry, with Products (704 lines) and Reviews (557
lines, 3 cards) slotted in as `children`. ~15 cards on one tab. `Scores` renders
the literal string `"Soon."`.

**After:** Place · Products · Promos · Reviews · Team. Scores retired.

Reviewed by `/plan-design-review` (2/10 → 8/10) and `/plan-eng-review`
(9 findings, 3 cross-model tensions). T1 shipped separately in #571.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Team's fate | Own tab. 292 lines of EF-backed UI; folding it into Place re-bloats the page we're splitting. |
| 2 | Scores' fate | Retired. It renders `"Soon."`, and `nav.ts:11` already says dead tabs dilute IA. |
| 3 | Place stubs | Read-only Menus card + Ratings row, matching `PromosCard` / `OwnershipCard`. |
| 4 | Fifth tab name | **Reviews**, route `/reviews`. Rename to Performance when analytics ship. |
| 5 | Empty-state depth | Generic. "Never enriched" vs "no reviews" deferred. |
| 6 | ProductsSection remount | Keep `key={place.id}`, moved to the Products page. Its draft state is a `useState` initializer. |
| 7 | Stub card location | New `sections/place-cards/` module; move `PromosCard` + `OwnershipCard` there too. |
| 8 | Per-tab page width | A `width` field on each `UNIT_SECTIONS` entry, read by a shared wrapper. |
| 9 | Tests | Vitest + RTL, added in this PR. The lifted nav guard (E1) is the first real behavior worth pinning. |
| 10 | Nav guard | Lifted into `UnitPlaceContext` **before** the stubs land. Also guards `popstate`. |
| 11 | Tab count | 5, not 4. Outside voice argued for folding Products back into Place; rejected. |
| 12 | PR shape | **One PR.** The by-cause split collapsed: T10/T12 edit the same files as T4/T11. |

## Information architecture

```
┌─ STICKY CHROME (unchanged) ─────────────────────────────────┐
│ [img] Strana Guadalajara         [Switch place] [Re-enrich]  │
│       ● Active · Nightclub                                   │
├──────────────────────────────────────────────────────────────┤
│    Place    Products    Promos    Reviews    Team            │
└──────────────────────────────────────────────────────────────┘
```

**Place** (`max-w-7xl`, masonry) — completeness banner, editable spine, then
read-only zone:

```
Manual Priority → Basics → Hours → Channels → Reservations → Photos → Location
── read-only ──
Menus (stub) → Ratings (stub) → Ownership → Promos → Metadata → Embeddings
```

Both stubs go in the read-only zone at the tail, not the old `children` slot
between Photos and Location. Dropping them in place interleaves read-only cards
among editable ones and throws away the split's IA win.

**Products** (`max-w-3xl`, single column) · **Promos** (`max-w-6xl`) ·
**Reviews** (`max-w-5xl`, single column) · **Team** (`max-w-6xl`).

New pages need an explicit gap: `SectionCard` (`ui.tsx:61`) has **no margin** of
its own. Today's spacing comes entirely from the masonry parent's
`[&>section]:mb-4`. A bare `<div className="mx-auto max-w-5xl">` ships three
flush-stacked cards on Reviews.

## Build order (sequence is load-bearing)

```
E1  guard lift ──┐
T3  routes ──────┼──> T2 nav ──> E2 perf-id ──> T4 PlaceSection ──> T5, T6
                 │                                                    │
                 └────────────────────────────────────────────────────┘
                                    then: T7–T14, E3–E5
```

Two orderings will bite if ignored:

- **T3 before T2.** `products/page.tsx` and `reviews/page.tsx` are currently
  server `redirect()`s *to* `/place`. Ship the nav first and clicking Products
  bounces back to Place — and with dirty state it's worse: dialog → "Discard &
  leave" → `requestDiscard()` wipes the form → push → redirect home. The
  operator loses edits and lands where they started.
- **E1 before T4.** T4 adds two more cross-tab links to the dirtiest surface in
  the app. They must be guarded when they land, not after.

## Interaction states

```
TAB/FEATURE        | LOADING      | EMPTY                        | ERROR             | PARTIAL
-------------------|--------------|------------------------------|-------------------|------------------
Shell (all tabs)   | Spinner ✓    | n/a                          | ErrorNote+Retry ✓ | n/a
Place cards        | inherits     | per-field "—" ✓              | per-box ✓         | ✓
Products           | inherits     | page-level first-run (NEW)   | SaveBar ✓         | legacy menu note
Reviews: Mesita    | inherits     | "—" + "No Mesita reviews yet" | none             | n/a  (shipped #571)
Reviews: Google    | inherits     | card renders empty, not hidden | none            | Apify cap note
Team               | "Checking…" ✓| "No owners" ✓                | add Retry         | ✓
```

## What already exists (reuse, do not rebuild)

- `SectionCard`, `SaveBar`, `ReadField` (`ui.tsx`) — the whole vocabulary. Zero
  new components beyond the two stubs.
- `PromosCard` (`PlaceSection.tsx:1451`) and `OwnershipCard` (`:1565`) — the
  read-only-stub pattern. `OwnershipCard`'s loading/error/empty triple is the
  reference implementation.
- `menusFromPlace` (`ProductsSection.tsx:65`) — **the Menus stub must import
  this**, not read `place.products?.menu` directly. Menu presence has a
  three-source precedence ladder (`products.menu` → `menus[]` →
  `menu_pdf_url`) and `ProfileCompleteness.tsx:75-78` checks all three. A stub
  that reimplements it will say "no menus" on legacy places while the banner
  8px above says Menu ✓.
- `UnitPlaceContext` keys dirty state per section and lives in `UnitEditShell`
  above the tab pages, so the guard survives the split.
- `products` / `reviews` routes already exist as redirects; `soon` gating in
  `nav.ts:24` stays for `scan`.

## NOT in scope

- **Place tab density.** 15 cards → 13. The split buys per-tab focus, not
  decluttering. Do not sell it as decluttering.
- **Lifting `enrichStatus` into context** so Reviews can distinguish "never
  enriched" from "no reviews" (decision 5). Note this makes E5 harder: the poll
  backoff has to be implemented in two components instead of one.
- **Analytics widgets** on Reviews. That is what triggers the rename.
- **Place masonry redesign.** Reordering only.
- **`products` blob lost update.** `ProductsSection.tsx:299` and
  `PlaceSection.tsx:353` both read-modify-write the same JSON column from their
  own copy of `place`. Harmless within one UI tab (only one section mounts at a
  time, context updates on save). Two *browser* tabs on the same place will
  clobber each other's sub-key. Accepted: pre-existing, internal tool, small
  operator count. Documented so it isn't rediscovered as a mystery bug.
- **Server-side narrowing of the `products` patch.** Would close the above, but
  it's an Edge Function change inside a frontend refactor, and the backend is a
  singleton.

## Failure modes

| New codepath | Realistic production failure | Test? | Error handling? | Silent? |
|---|---|---|---|---|
| Guard lift (E1) | Guard swallows a legitimate nav; operator stuck on Place | E3 | dialog Cancel path | no |
| Route flip (T3) | `/scores` bookmark 404s instead of redirecting | E3 | — | **yes → critical** |
| Nav catalog (T2) | `?section=scores` resolves to nothing, blank page | E3 | falls back to `place` | no |
| Menus stub (T4) | Reads `products.menu` only; contradicts banner on legacy places | E3 | — | **yes → critical** |
| Ratings stub (T4) | Reproduces the 5.0 default killed in #571 | E3 | — | **yes → critical** |
| popstate guard (E4) | Cleanup clears the dirty flag before the listener reads it | E3 | — | **yes → critical** |
| Poll backoff (E5) | Backoff applied to one of two polls; cost halves, not drops | — | — | yes |

**4 critical gaps** — all silent-failure paths. Each is covered by the E3 test
work; none has error handling today.

## Parallelization

Sequential implementation, minimal parallelization opportunity. E1 → T3 → T2 →
T4 is a hard chain through shared files (`UnitPlaceContext`, `nav.ts`,
`PlaceSection`). Two genuinely independent lanes exist once T4 lands:

| Lane | Tasks | Modules | Depends on |
|---|---|---|---|
| A | E1, T3, T2, E2, T4, T5, T6 | context, nav, routes, sections/place-cards | — (sequential chain) |
| B | T7, T8, T9 | sections/ReviewsSection, ProductsSection, routes | T3 |
| C | T10, T11, T13, T14 | UnitEditChrome, TeamSection, layout shell | — |

Lanes B and C are independent of each other and of lane A after T3. **Conflict
flag:** lane C's T10/T11 both edit the same `<nav>` block in
`UnitEditChrome.tsx:257-271` — keep them sequential within the lane.

## Implementation Tasks

- [ ] **E1 (P1, human: ~3h / CC: ~30min)** — UnitPlaceContext — lift the nav guard, fix two bare links
  - Surfaced by: Outside voice #1, verified — `guardNav` is local to `UnitEditChrome:102`; `PlaceSection.tsx:1478` and `:1583` are unguarded `<Link>`s that lose unsaved edits today
  - Files: `UnitPlaceContext.tsx`, `UnitEditChrome.tsx`, `sections/PlaceSection.tsx`
  - Verify: edit Basics, click "Edit on Promos" → discard dialog appears
  - **Must land before T4.**

- [ ] **T3 (P1, human: ~1h / CC: ~10min)** — routes — flip three files
  - Surfaced by: Architecture — `products/page.tsx` and `reviews/page.tsx` currently redirect *to* `/place`; they are `async` server components and need full rewrites to `"use client"` for `useUnitPlace`
  - Files: `[projectId]/{products,reviews,scores}/page.tsx`
  - Verify: `/products` and `/reviews` render; `/scores` redirects and never 404s
  - **Must land before T2.**

- [ ] **T2 (P1, human: ~1h / CC: ~10min)** — nav.ts — 5-tab catalog with per-section width
  - Surfaced by: Pass 1 IA; Code Quality finding 4 (five hardcoded widths)
  - Files: `nav.ts`
  - Verify: tablist renders 5 tabs; `?section=scores` falls back to `place`

- [ ] **E2 (P1, human: ~20min / CC: ~5min)** — nav.ts — resolve the `performance` id collision
  - Surfaced by: Outside voice #6 — `nav.ts:19` still holds `{id:"performance", soon:true}` plus a live route, colliding with decision 4's future rename
  - Files: `nav.ts`, `[projectId]/performance/page.tsx`
  - Verify: catalog has one future-analytics concept, not two

- [ ] **T4 (P1, human: ~3h / CC: ~25min)** — PlaceSection — extract place-cards, add stubs, reorder
  - Surfaced by: Pass 1 findings 1–2; Code Quality finding 3
  - Files: `sections/PlaceSection.tsx`, new `sections/place-cards/`, `[projectId]/place/page.tsx`
  - Verify: no `children` prop remains; Menus stub imports `menusFromPlace`; Ratings stub shows `—` at zero reviews

- [ ] **T5 (P1, human: ~45min / CC: ~10min)** — dirty dialog names the dirty section
  - Surfaced by: Design Pass 2 — `UnitEditChrome.tsx:299` hardcodes "Unsaved Place edits"
  - Files: `UnitEditChrome.tsx`, `UnitPlaceContext.tsx`
  - Verify: unsaved menu → dialog reads "Unsaved Products edits"

- [ ] **T6 (P2, human: ~2h / CC: ~20min)** — completeness chips become actionable
  - Surfaced by: Design Pass 3; rescoped by outside voice #10 — only 1 of 10 checks is cross-tab (Menu → Products); the other 9 target cards on the same page and no `SectionCard` has an `id`
  - Files: `sections/ProfileCompleteness.tsx`, `ui.tsx`
  - Verify: "Add a menu" routes to Products; the other nine scroll to their card

- [ ] **T7 (P2, human: ~1h / CC: ~10min)** — Google reviews card renders empty instead of vanishing
  - Surfaced by: Design Pass 2 — hidden at `ReviewsSection.tsx:498`, taking the Apify-cap subtitle with it
  - Files: `sections/ReviewsSection.tsx`
  - Verify: 0 scraped reviews still shows the card and the cap explanation

- [ ] **T8 (P2, human: ~1h / CC: ~10min)** — Products page-level empty state
  - Surfaced by: Design Pass 2 — `ProductsSection.tsx:328` is a card-sized empty alone on a page
  - Files: `[projectId]/products/page.tsx`, `sections/ProductsSection.tsx`
  - Verify: no menus → real first-run state at `max-w-3xl`

- [ ] **T9 (P2, human: ~30min / CC: ~5min)** — Reviews page single column, explicit gap
  - Surfaced by: Design Pass 5; outside voice #8 — `SectionCard` has no margin of its own
  - Files: `[projectId]/reviews/page.tsx`
  - Verify: three cards are spaced, not flush; `w-72` rails don't strand dead space

- [ ] **T10 (P2, human: ~30min / CC: ~5min)** — tablist is a nav, not an ARIA tab widget
  - Surfaced by: Design Pass 6 — `role="tablist"`/`role="tab"` with no tabpanel, `aria-controls`, or arrow keys
  - Files: `UnitEditChrome.tsx:257-271`
  - Verify: matches `UnitDock.tsx:126` (plain `<nav>` + `aria-current="page"`)

- [ ] **T11 (P2, human: ~45min / CC: ~10min)** — overflow affordance for the fifth tab
  - Surfaced by: Design Pass 6 — `overflow-x-auto` with hidden scrollbars clips silently
  - Files: `UnitEditChrome.tsx:260`
  - Verify: at 375px no tab is invisible

- [ ] **E3 (P1, human: ~1d / CC: ~1.5h)** — Vitest + RTL, first test infra in web-admin
  - Surfaced by: Test review — zero test files, CI is lint/typecheck/build only, 4 silent-failure paths
  - Files: `vitest.config.ts`, `package.json`, `.github/workflows/web-admin.yml`, new `__tests__/`
  - Verify: covers nav resolution, redirect map, stub states, guard transitions; CI runs it

- [ ] **E4 (P2, human: ~2h / CC: ~20min)** — guard browser back/forward
  - Surfaced by: Test review finding 6 — no `popstate` handling; only Link `onClick` and `beforeunload`
  - Files: `UnitPlaceContext.tsx`
  - Verify: dirty Place edits + browser Back → dialog, not silent loss
  - Note: sections clear their dirty flag on unmount (`PlaceSection:469`), so a naive listener reads `false`. Needs a `pushState` sentinel installed while dirty.

- [ ] **E5 (P2, human: ~1.5h / CC: ~20min)** — back off the enrichment poll, pause on hidden
  - Surfaced by: Performance review; outside voice #5 — **two** polls exist (`UnitEditChrome.tsx:84` and `PlaceSection.tsx:597`), 900 EF invocations/hour on Place
  - Files: `UnitEditChrome.tsx`, `sections/PlaceSection.tsx`
  - Verify: idle backs off to ~60s; hidden tab stops; both polls covered

- [ ] **T12 (P3, human: ~30min / CC: ~5min)** — re-derive card tints after the reorder
  - Surfaced by: Design Pass 4 — `ui.tsx:53` rule already violated twice
  - Files: `sections/PlaceSection.tsx`, `sections/place-cards/`, `sections/ManualPriorityCard.tsx`
  - Verify: no two cards share a tint in source order. Note: true *visual* adjacency is unverifiable under CSS `columns` and changes per breakpoint — source order is the only checkable proxy.

- [ ] **T13 (P3, human: ~20min / CC: ~5min)** — Team load error gets a Retry
  - Surfaced by: Design Pass 2 — `TeamSection.tsx:42-45` sets error and stops
  - Files: `sections/TeamSection.tsx`
  - Verify: matches `UnitEditShell.tsx:75-84`

- [ ] **T14 (P3, human: ~10min / CC: ~3min)** — delete the unreachable PageHeader branch
  - Surfaced by: Outside voice #11 — `ManageSingleLayoutShell.tsx:32-40` is dead; every route matches an earlier branch. Its stale copy was going to be "fixed" rather than removed.
  - Files: `ManageSingleLayoutShell.tsx`
  - Verify: no route renders it

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 9 issues, 4 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score: 2/10 → 8/10, 5 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CROSS-MODEL:** Outside voice ran as a Claude subagent (Codex not installed). Three of its findings were verified against source and confirmed: the unguarded cross-tab links, the duplicate enrichment poll, and `SectionCard`'s missing margin. Three tensions were raised and put to the user: 4-vs-5 tabs (kept 5), Vitest timing (kept in this PR), and the PR split (accepted — collapsed to one PR).
- **VERDICT:** ENG + DESIGN CLEARED — ready to implement.

NO UNRESOLVED DECISIONS
