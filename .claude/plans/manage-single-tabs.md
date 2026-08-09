<!-- /autoplan restore point: /home/ubuntu/.gstack/projects/canzeco-mesita-monorepo/main-autoplan-restore-20260809-143825.md -->
# Manage Single — SUPERSEDED → residual plan (MESITA-900)

> **AUTOPLAN VERDICT (2026-08-09): CANCEL original. REWRITE residual.**
>
> The original plan's "Today" IA (Place · Promos · Scores · Team) is **false** on
> current `main`. Live IA (Pato, MESITA-900, 2026-08-05) is **Place · Promos ·
> Performance · Settings · Admin**. Implementing the original target
> (Place · Products · Promos · Reviews · Team) would undo that decision.
> Prior Eng/Design CLEAR on the original document is **void**.

---

## Original plan (archived — do not implement)

<details>
<summary>Collapsed original summary</summary>

**Claimed Today:** Place · Promos · Scores · Team (Scores = `"Soon."`).
**Claimed After:** Place · Products · Promos · Reviews · Team; Scores retired.
**Claimed work:** E1–E5, T2–T14 (guard lift, route flips, stubs, Vitest infra, …).

**Why cancelled:** nearly every structural premise failed re-verification against
HEAD (see CEO review below). Guard lift, Vitest+CI, Performance tab, Team→Settings,
Reviews→Performance, Scores→Admin card, PromosCard/OwnershipCard removal, and the
single enrichment poll are already shipped.

</details>

---

## Ground truth (HEAD — verified 2026-08-09)

| Surface | Live behavior |
|---|---|
| Tabs | `UNIT_TAB_SECTIONS`: place · promos · performance · settings · admin (`nav.ts:15-21`) |
| Products | Embedded in Place as `PlaceSection` children (`place/page.tsx:18-20`) — 812-line `ProductsSection` |
| Reviews | Catch-all → `/performance`; UI = ReputationStrip / Performance cards. **No `ReviewsSection.tsx`** |
| Team | Catch-all → `/settings`; `SettingsSection` embeds `TeamSection` |
| Scores | Not a tab. `ScoresCard` on Admin |
| Catch-all | `team→settings`, `reviews\|reservations→performance`, else→place (`[...slug]/page.tsx`) |
| Dirty guard | `guardNav` / `guardIntent` already on `UnitPlaceContext` (E1 shipped) |
| Enrich poll | Only `UnitEditChrome` @ 8s (`:75-94`). PlaceSection one-shot media fetch |
| Tests | Vitest + CI `pnpm run test` exist; manage-single has `promo-state.test.ts` only |
| Dirty dialog | Hardcodes "Unsaved Place edits" (`UnitPlaceContext.tsx:166`) |
| Promos | Write-through / optimistic — **no draft dirtyMap** (do not invent one) |
| Settings dirty | Reservations / Check PIN / Require bill have SaveBar drafts but **never** call `setSectionDirty` |
| Tab ARIA | `role="tablist"`/`tab` without tabpanels (`UnitEditChrome.tsx:252-265`) |
| Overflow | `overflow-x-auto` + hidden scrollbars (`:254`) |
| Team error | `ErrorNote` shown; **no Retry** (`TeamSection.tsx:179`) |
| Dead branch | `ManageSingleLayoutShell` final `PageHeader` unreachable (`:32-40`) |

---

## Residual problem (the real work)

Optimize operator throughput **inside** MESITA-900 — do not resurrect Reviews/Team/Scores tabs.

**Open product question (taste):** Should Products stay embedded in Place, or get its own tab under the current five?

Everything else is polish/safety on the live shell.

---

## Decisions (autoplan / CEO)

| # | Decision | Choice | Class |
|---|----------|--------|-------|
| D1 | Original 5-tab resurrection | **CANCEL** — fights MESITA-900 | User challenge resolved by Pato live IA |
| D2 | Prior Eng/Design CLEAR | **VOID** | Mechanical |
| D3 | Mode | SELECTIVE EXPANSION → collapsed to residual | Mechanical |
| D4 | Products tab vs embedded | **Keep embedded for now**; open thin follow-up if Place density still hurts after residual polish | Taste → recommend keep |
| D5 | ScoresCard on Admin | **Keep** — "retire Scores tab" is moot | Mechanical |
| D6 | Catch-all redirects | **Keep** as canonical retired-route map | Mechanical |
| D7 | Scope of this residual plan | UX/perf/a11y/safety on live tabs + optional Products density later | Mechanical |

---

## Information architecture (live — unchanged)

```
┌─ STICKY CHROME ─────────────────────────────────────────────┐
│ [img] Place name              [Switch place] [Re-enrich]     │
├──────────────────────────────────────────────────────────────┤
│    Place    Promos    Performance    Settings    Admin       │
└──────────────────────────────────────────────────────────────┘
```

- **Place** — completeness + masonry (Basics → Hours → Channels → Photos → Products children → Location)
- **Promos** — own tab (dirty state gap — see R2)
- **Performance** — reputation / activity / reservations
- **Settings** — Reservations + Check PIN + Require bill + Team (channels live on Place)
- **Admin** — ScoresCard, verification, metadata, embeddings, …

---

## Interaction states (residual gaps only)

```
FEATURE              | GAP
---------------------|--------------------------------------------------
Dirty dialog         | Always says "Place" even when Products dirty
Promos edits         | Not in dirtyMap — silent loss on tab switch
Browser Back         | No popstate guard
Enrich poll          | Fixed 8s; no document.hidden pause
Team load error      | ErrorNote, no Retry
Tab strip            | Fake tablist; overflow clips silently at 375px
Completeness chips   | Inert spans; Menu hint doesn't route/scroll
```

---

## What already exists (reuse)

- `UnitPlaceContext.guardNav` / `guardIntent` / dirtyMap
- `UNIT_TAB_SECTIONS` + catch-all redirects
- Vitest + CI test job (extend; do not bootstrap)
- `ErrorNote` + `UnitEditShell` Retry pattern (`UnitEditShell.tsx:75-84`)
- `CrossTabLink` in `ui.tsx` (unused — candidate for completeness Menu chip)
- `CrossTabLink` for Reservations → Settings; ConfigTabNav is also fake-tablist (E-R6 honesty)

## NOT in scope

- Reviews / Team / Scores **tabs** (MESITA-900)
- Re-lifting guardNav (done)
- Bootstrapping Vitest/CI (done)
- Menus/Ratings Place stubs that re-bloat Place
- Edge Function products-patch narrowing
- Admin console DESIGN.md (stays in TODOS.md)
- Promoting Products to its own tab (deferred taste; see D4)

---

## Failure modes (residual)

| Codepath | Realistic failure | Test? | Silent? |
|---|---|---|---|
| Promos dirty unwired (R2) | Operator loses promo edits on tab switch | R8 | **yes → critical** |
| popstate (R3) | Browser Back drops dirty Place/Products | R8 | **yes → critical** |
| Enrich poll (R4) | 450 EF calls/hour/open editor while idle/hidden | — | yes (cost) |
| Completeness Menu chip (R7) | Operator sees Menu ✗ with no path to Products card | — | yes (UX) |
| Tab overflow (R6) | Fifth tab invisible at 375px | manual | **yes** |

---

## Implementation Tasks (residual — Design/Eng corrected)

> **Do not implement Promos draft-dirty.** Promos is write-through/optimistic.
> Critical silent-loss gap is **Settings SaveBar cards**.

- [ ] **E-R1 (P1, human: ~2h / CC: ~25min)** — Wire Settings SaveBar cards into UnitPlaceContext dirtyMap
  - Surfaced by: Design+Eng re-verification — `ReservationsCard` / `CheckPinCard` / `RequireBillCard` have local `dirty` + SaveBar but never call `setSectionDirty`
  - Files: `sections/ReservationsCard.tsx`, `CheckPinCard.tsx`, `RequireBillCard.tsx`, optionally shared hook; `UnitPlaceContext.tsx`
  - Keys: `reservations` | `check-pin` | `require-bill` + `registerDiscardHandler` to reset local drafts
  - Verify: edit Check PIN → switch to Place → discard dialog; Cancel keeps PIN draft; Confirm resets

- [ ] **E-R2 (P1, human: ~45min / CC: ~10min)** — Dirty dialog names dirty section(s)
  - Surfaced by: `UnitPlaceContext.tsx:166` hardcodes "Unsaved Place edits"
  - Spec: title/body from dirty keys (`place`, `products`, `reservations`, `check-pin`, `require-bill`); multi → list labels
  - Files: `UnitPlaceContext.tsx` (extract pure `dirtySectionLabels` helper for unit tests)
  - Verify: Products-only dirty → "Unsaved Products edits"; Settings PIN dirty → names Check PIN

- [ ] **E-R3 (P1, human: ~3h / CC: ~35min)** — History guard (`popstate`) compatible with section unmount
  - Surfaced by: Eng — Place/Products clear dirty on unmount; naive listener sees `isDirty===false` after Back
  - Spec: while dirty, maintain `pushState` sentinel; on `popstate`, re-assert URL + open discard dialog **before** relying on mounted section state; Cancel → `history.forward()`; Confirm → discard then allow
  - Files: `UnitPlaceContext.tsx` (preferred) and/or `UnitEditChrome.tsx`
  - Verify: dirty Place + browser Back → dialog; Cancel restores; Confirm leaves

- [ ] **E-R4 (P2, human: ~1h / CC: ~15min)** — Enrich poll backoff + pause when hidden
  - Files: `UnitEditChrome.tsx:75-94`
  - Spec: while enriching keep ≤8s; else backoff ~60s or stop; `visibilitychange` pause + immediate fetch on visible
  - Verify: hidden tab stops; idle cost drops

- [ ] **E-R5 (P2, human: ~30min / CC: ~5min)** — Team load error Retry
  - Files: `sections/TeamSection.tsx:179` — call existing `load()` (`:70-80`)
  - Verify: mirrors `UnitEditShell` Retry; action errors stay ErrorNote-only

- [ ] **E-R6 (P2, human: ~1h / CC: ~15min)** — Tab strip overflow + honest a11y
  - Files: `UnitEditChrome.tsx:251-288`
  - Spec: overflow cue at 375px (edge fade or visible scrollbar). A11y: either keep `tablist` (matches `ConfigTabNav`) **or** demote both manage-single + ConfigTabNav to plain `<nav>` + `aria-current="page"` — do not cite ConfigTabNav as plain-nav today
  - Verify: Admin tab reachable at 375px

- [ ] **E-R7 (P2, human: ~1.5h / CC: ~20min)** — Completeness chips: Menu scroll + Reservations cross-tab
  - Files: `ProfileCompleteness.tsx`, `ProductsSection.tsx` / `ui.tsx` SectionCard `id`, `CrossTabLink`
  - Menu (same-tab): add Products scroll target → chip `scrollIntoView`+focus (**not** CrossTabLink)
  - Reservations: `CrossTabLink` / `guardNav` → Settings
  - Other chips: defer (document in NOT in scope) unless cheap scroll ids land
  - Verify: missing Menu scrolls to Products; missing Reservations navigates to Settings (guarded if dirty)

- [ ] **E-R8 (P1, human: ~3h / CC: ~45min)** — Tests for E-R1–E-R3 under real Vitest capabilities
  - Surfaced by: Eng — `environment: "node"`, no `@testing-library` / jsdom today
  - Prefer pure unit tests of `dirtySectionLabels` + history-sentinel state machine
  - Add jsdom+RTL only if component mounts are mandatory; do not claim RTL infra already exists
  - Files: new `*.test.ts` next to helpers; CI already runs `pnpm run test`
  - Verify: Settings dirty keys → dialog labels; sentinel Cancel/Confirm transitions

- [ ] **E-R9 (P3, human: ~10min / CC: ~3min)** — Delete unreachable PageHeader branch
  - Files: `ManageSingleLayoutShell.tsx:32-40`
  - Verify: unit + select hubs still full-bleed

- [ ] **E-R10 (P3, human: ~20min / CC: ~5min)** — Scrub stale comments
  - Files: `PlaceSection.tsx` ("Promos summary"), `UnitPlaceContext.tsx` (PromosCard)
  - Verify: comments match MESITA-900

- [ ] **E-R0 (docs)** — One-line comment on PromosSection: write-through, no draft dirtyMap
  - Do **not** invent Promos draft dirty

### Build order

```
E-R1 → E-R2 → E-R3 → E-R8
E-R4, E-R5, E-R9, E-R10 independent
E-R7 after Products scroll id exists (can follow E-R1)
E-R6 independent
```

---

# DESIGN REVIEW (autoplan Phase 2) — 2026-08-09

**Codex:** unavailable — `[subagent-only]`  
**DESIGN.md:** absent (TODOS.md debt) — calibrated against calm dense light admin + SectionCard/SaveBar.

### Scores (plan quality after corrections applied in tasks above)

| Dimension | Pre-fix | Post-correction target | Notes |
|---|---|---|---|
| IA | 7 | 8 | Settings blurb fixed below; honors MESITA-900 |
| Interaction states | 3 | 8 | Settings dirty + dialog + popstate specified |
| Hierarchy & density | 6 | 6 | D4 keep Products embedded |
| Navigation & wayfinding | 5 | 8 | Menu scroll + Reservations CrossTabLink |
| Accessibility | 5 | 7 | Honest tablist vs nav choice |
| Responsive / overflow | 4 | 7 | Concrete 375px cue |
| Consistency | 5 | 8 | Don't invent Promos drafts; reuse SaveBar dirty |

### Live IA correction

**Settings** = Reservations + Check PIN + Require bill + Team (`SettingsSection.tsx`).  
Channels live on **Place**, not Settings.

### Dual voices

**CODEX SAYS (design):** `[codex-unavailable]`  
**CLAUDE SUBAGENT (design):** CANCEL original correct; Promos R1 false; Settings SaveBars real critical; ConfigTabNav mis-cited; CrossTabLink wrong for Menu.

```
DESIGN LITMUS — CONSENSUS (subagent-only):
  1. Hierarchy serves operator?     YES (residual) / NO (original)
  2. States specified?              WAS NO → YES after E-R rewrite
  3. Specific UI decisions?         WAS THIN → tightened in E-R*
  4. A11y intentional?              PARTIAL — E-R6 forces honesty
  5. Responsive intentional?        PARTIAL — E-R6
  6. Matches admin patterns?        YES after dropping Promos draft dirty
  7. Haunt ambiguities cleared?     YES if E-R1–E-R3/E-R7 followed
```

**Phase 2 complete.** Passing to Phase 3.

---

# ENG REVIEW (autoplan Phase 3) — 2026-08-09

**Codex:** unavailable — `[subagent-only]`

### Scope challenge

Examined `nav.ts`, catch-all, `UnitPlaceContext`, `UnitEditChrome`, Place/Products/Promos/Settings cards, vitest config, CI. Original plan tasks E1/T3/E2/E3-bootstrap are obsolete. Residual-as-first-draft had a false critical (Promos). Corrected E-R* is implementable.

### Architecture

```
UnitPlaceContext (dirtyMap, guardNav, dialog labels, history sentinel)
    ├─ PlaceSection / ProductsSection (already wired)
    ├─ Settings cards (E-R1 — NEW wire)
    ├─ UnitEditChrome (tabs E-R6, poll E-R4, beforeunload uses isDirty)
    └─ ProfileCompleteness (E-R7 Menu scroll + Reservations link)
PromosSection — write-through; E-R0 comment only
```

### Code quality

- Extract `dirtySectionLabels` + history sentinel helpers (testable under node env)
- Optional tiny `useSectionDirty(key)` hook for three Settings cards (DRY, P4)
- Do not add Promos dirty abstraction

### Test review

| Codepath | Test | Exists? |
|---|---|---|
| promo-state pure | unit | YES |
| Settings → dirtyMap | unit | NO → E-R8 |
| Dialog labels from keys | unit | NO → E-R8 |
| History sentinel machine | unit | NO → E-R8 |
| Completeness Menu/Reservations | component (needs jsdom) | NO — optional |
| Tab overflow @375 | manual | NO |

### Performance

Single 8s enrich poll always-on even when idle — E-R4. No N+1 introduced by residual.

### Security

No new auth surfaces. Check PIN / require-bill silent-loss is ops integrity (HIGH) — fixed by E-R1.

### Failure modes (corrected)

| Codepath | Failure | Silent? | Critical? |
|---|---|---|---|
| Settings dirty + tab | Edits dropped | yes | **CRITICAL** |
| Settings dirty + reenrich/beforeunload | Same | yes | HIGH |
| Naive popstate post-unmount | False clean | yes | **CRITICAL if shipped wrong** |
| Completeness inert chips | Dead-end | yes | MED |
| Enrich always-on | Cost | yes | MED |

### Eng consensus

```
ENG DUAL VOICES — CONSENSUS TABLE:
  1. Architecture sound?     YES (after E-R rewrite)  Codex N/A
  2. Test coverage plan?     YES (node-first)         Codex N/A
  3. Performance risks?      YES addressed (E-R4)     Codex N/A
  4. Security threats?       Ops integrity via E-R1   Codex N/A
  5. Error paths handled?    Team Retry E-R5          Codex N/A
  6. Deployment risk?        Frontend-only; low       Codex N/A
Source: subagent-only
```

**Eng CLEAR (residual E-R*)** — not the original plan.

**Phase 3 complete.** Passing to Phase 3.5.

---

# DX REVIEW (autoplan Phase 3.5) — 2026-08-09

**Skip rationale (partial):** Keyword DX trigger fired on plan text (`package`, `import`, `implement`), but the product surface is an **internal admin operator UI**, not a developer API/CLI/SDK. Full 8-dimension product DX does not apply.

**Implementer DX (agents shipping E-R*) — thin pass:**

| Dimension | Score | Note |
|---|---|---|
| Spec clarity | 8 | E-R* now concrete with verify steps |
| Test onboarding | 5 | Must not assume RTL; document node-first |
| Error messages | n/a | Operator UI |
| Naming | 8 | E-R ids + dirty keys enumerated |
| Escape hatches | 7 | E-R6 allows keep-tablist option |
| Docs | 6 | Stale comments scrubbed in E-R10 |

TTHW for implementer: ~15 min to first failing test for `dirtySectionLabels` once helper extracted.

**Phase 3.5 complete (thin implementer DX).** Passing to Final Gate.

---

## Cross-phase themes

1. **Stale world model** — CEO + Design + Eng independently found the original "Today" IA false. High-confidence CANCEL.
2. **Silent dirty loss** — Design+Eng converged on Settings SaveBars (not Promos) as the real critical.
3. **popstate × unmount** — Eng critical; Design high — must ship history trap, not a naive listener.
4. **Test infra honesty** — Eng flagged RTL/jsdom gap; DX implementer pass agrees.

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Mode = SELECTIVE → residual | Mechanical | P6 | Feature iteration default | Full expansion / hold obsolete scope |
| 2 | CEO | CANCEL original target IA | User challenge → Pato wins | Hierarchy | MESITA-900 live > plan text | Reviews/Team tab resurrection |
| 3 | CEO | Void prior Eng/Design CLEAR | Mechanical | P5 | Clearance of ghost product | Treating CLEAR as auth |
| 4 | CEO | Keep Products embedded (D4) | Taste | P3/P5 | Smallest change that honors IA | Products tab now |
| 5 | CEO | Include Promos dirty (R1) | Mechanical | P1/P2 | Silent data loss in blast radius | Defer |
| 6 | CEO | Skip /office-hours prereq | Mechanical | P6 + Mesita | Never-ask; plan exists | Blocking on design doc |
| 7 | CEO | Premise gate auto-pass (reframed) | Mechanical | Mesita | Never-ask; invalid premises rejected | Asking Pato to restate MESITA-900 |
| 8 | Design | Retarget R1 Promos→Settings dirty | Mechanical | P1/P5 | Promos write-through; Settings SaveBars real | Invent Promos draft dirty |
| 9 | Design | Menu=scroll, Reservations=CrossTabLink | Mechanical | P5 | Same-tab vs cross-tab | CrossTabLink for Menu |
| 10 | Design | Fix Settings IA blurb | Mechanical | P5 | Channels on Place | Channels on Settings |
| 11 | Eng | Expand E-R3 history trap | Mechanical | P1 | Unmount clears dirty | Naive popstate listener |
| 12 | Eng | Node-first tests, no fake RTL | Mechanical | P5 | vitest env=node today | Claim RTL exists |
| 13 | Eng | CLEAR residual only | Mechanical | P6 | E-R* implementable | CLEAR original |
| 14 | DX | Skip product DX; thin implementer | Mechanical | P3 | Admin operator UI | Fake 8-dim DX scores |
| 15 | Gate | Auto-approve residual E-R* | Mechanical | Mesita+P6 | Never-ask final gate | Blocking approval |


---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` Phase 1 | Scope & strategy | 1 | **CANCEL original / residual rewrite** | Baseline IA false; MESITA-900 wins |
| Design Review | `/autoplan` Phase 2 | UI/UX | 1 | CLEAR (residual E-R*) | Promos R1 false; Settings dirty critical |
| Eng Review | `/autoplan` Phase 3 | Architecture & tests | 1 | CLEAR (residual E-R*) | popstate×unmount; node-first tests |
| DX Review | `/autoplan` Phase 3.5 | Implementer DX only | 1 | THIN PASS | Product DX N/A (admin UI) |
| Codex voices | all phases | Dual voice | 0 | unavailable | binary not found |

- **CROSS-MODEL:** Codex unavailable all phases — `[subagent-only]`. Primary + Claude subagents agreed CANCEL + Settings-dirty retarget.
- **VERDICT:** Original plan **must not be implemented**. Residual **E-R1–E-R10** ready to implement.
- **USER CHALLENGE (resolved by hierarchy):** Original target IA vs MESITA-900 → Pato live IA wins; CANCEL without asking.
- **TASTE (auto-recommended):** D4 Keep Products embedded; defer own-tab to TODOS.

NO UNRESOLVED DECISIONS (Mesita never-ask; taste defaults logged)
