<!-- /autoplan restore point: /home/ubuntu/.gstack/projects/canzeco-mesita-monorepo/main-autoplan-restore-20260809-143833.md -->
# Manage Single Unit — residual polish (MESITA-900 shell)

Admin console, `apps/web-admin/src/app/(app)/manage-single/`.

> **SUPERSEDED IA TARGET.** The prior plan proposed Place · Products · Promos ·
> Reviews · Team. Live main (Pato, 2026-08-05, MESITA-900) is already
> **Place · Promos · Performance · Settings · Admin**. Products stay nested on
> Place; Reviews live in Performance (`ReputationStrip`); Team lives in
> Settings; Scores is a real Admin card, not a `"Soon."` tab. Implementing the
> old tab reshuffle would **regress** a settled product decision.
>
> This document is the /autoplan rewrite: kill the IA migration; ship residual
> polish/hardening against the current 5-tab shell.

## Verified against main (2026-08-09)

| Check | Live |
|---|---|
| `UNIT_TAB_SECTIONS` | `place · promos · performance · settings · admin` (`nav.ts:15-21`) |
| Products | Nested in Place (`place/page.tsx:18-19`) |
| Reviews | Performance via `ReputationStrip` |
| Team | Settings (`SettingsSection.tsx:29`) |
| Scores | `ScoresCard` on Admin — no Scores tab |
| Legacy routes | `[...slug]/page.tsx` redirects team→settings, reviews/reservations→performance, else→place |
| `guardNav` | Already in `UnitPlaceContext` + `CrossTabLink` |
| Vitest | Exists (`vitest.config.ts`, CI `pnpm test`) — no RTL yet |
| Enricher polls | One 8s poll in `UnitEditChrome.tsx:75-94` (Place second poll gone) |

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Tab IA | **Frozen to MESITA-900.** No Products/Reviews/Team/Scores top-level tabs. |
| 2 | Old plan status | Superseded. Prior Eng CLEAR / Design 8/10 applied to a dead target — void. |
| 3 | Scope mode | **SCOPE REDUCTION** → residual polish only (autoplan default SELECTIVE EXPANSION collapsed here because the baseline target was invalid). |
| 4 | Place density | **Out of this PR.** Higher leverage, but a separate IA/density project (see NOT in scope / TODOS). |
| 5 | Dirty dialog | Name dirty section(s) from `dirtyMap` (Place and Products can both be dirty on `/place`). |
| 6 | History guard | Add `popstate` / `pushState` sentinel while dirty — Link + `beforeunload` only today. |
| 7 | Enricher poll | Back off when idle/not enriching; pause on `document.hidden`. One poll only. |
| 8 | Tab a11y | Fake `role="tablist"` → plain `<nav>` + `aria-current="page"`. |
| 9 | Tests | Extend existing Vitest. Pin redirect map + section helpers. Add RTL only if needed for guard transitions — do not invent “first infra.” |
| 10 | PR shape | One small PR for residual polish. |

## Information architecture (LIVE — do not change)

```
┌─ STICKY CHROME ─────────────────────────────────────────────┐
│ [img] Place name              [Switch place] [Re-enrich]     │
├──────────────────────────────────────────────────────────────┤
│   Place    Promos    Performance    Settings    Admin        │
└──────────────────────────────────────────────────────────────┘

Place        — profile masonry + Products child card + completeness banner
Promos       — membership / strategy / rates
Performance  — headline · reputation strip · event boxes · reservations
Settings     — channel · check PIN · require bill · Team
Admin        — Mesita-internal (ScoresCard, metadata, embeddings, …)
```

## Build order

```
R2 popstate guard (dirtyRef) ──> R1 dirty dialog names ──> R6 tests
R3 poll backoff
R4 tablist → nav ──> R5 overflow affordance
R7 Team Retry
R8 completeness chips (chip→action table)
R9 dead PageHeader
```

**Hard order:** R2 before R1 (same `ConfirmDialog` block; R2 owns the intercept
contract). R2 before R6 (do not freeze “unmount clears dirty ⇒ allow leave”).
R4 before R5 (same nav). Never edit `UNIT_TAB_SECTIONS`.

## Interaction states (residual)

```
FEATURE              | LOADING | EMPTY              | ERROR              | PARTIAL
---------------------|---------|--------------------|--------------------|--------
Dirty dialog         | n/a     | n/a                | n/a                | multi-section names
Browser Back dirty   | n/a     | n/a                | dialog (NEW)       | n/a
Enricher chrome poll | spinner | idle               | poll error flag    | backoff (NEW)
Team (Settings)      | Checking| No owners          | ErrorNote+Retry NEW| ✓
Completeness chips   | n/a     | n/a                | n/a                | scroll/focus (NEW)
Tab chrome           | n/a     | n/a                | n/a                | overflow cue (NEW)
```

## What already exists (reuse)

- `guardNav` / `guardIntent` / `ConfirmDialog` in `UnitPlaceContext.tsx`
- `CrossTabLink` in `ui.tsx:539` (uses context `guardNav`)
- Vitest + CI test step (`package.json`, `.github/workflows/web-admin.yml`)
- Legacy redirect map in `[...slug]/page.tsx`
- `ErrorNote` + `UnitEditShell` Retry pattern for Team parity
- `ProfileCompleteness` chip list + `menusFromPlace` three-source ladder

## NOT in scope

- **Any tab IA change** (Products/Reviews/Team/Scores as top-level tabs).
- **Place masonry declutter / card extraction to Admin.** Separate project; higher leverage than chrome polish — deferred to TODOS.md.
- **`products` JSON lost-update** across browser tabs (pre-existing; accepted).
- **Server-side products patch narrowing** (EF change; backend singleton).
- **Performance activity ErrorNote Retry** — optional follow-on, not this PR.
- **Adding `@testing-library/react` greenfield ceremony** unless R2 genuinely needs it.

## Failure modes

| New codepath | Realistic failure | Test? | Silent? |
|---|---|---|---|
| popstate guard (R2) | Cleanup clears dirty before listener reads it | R6 | **yes → critical** |
| Dirty dialog names (R1) | Shows “Place” when only Products dirty | R6 | yes |
| Poll backoff (R3) | Stays at 8s while enriching ends → wasted EF calls | — | yes |
| Tab nav a11y (R4) | Breaks keyboard expectations if half-migrated | smoke | no |
| Overflow cue (R5) | Still clips a tab at 375px | visual | **yes → critical** |
| Team Retry (R7) | Button no-ops if `load` closed over stale id | — | no |
| Completeness chips (R8) | Scroll target missing (`id` absent on card) | R6 | yes |

## Implementation Tasks

- [ ] **R2 (P1, CC: ~35min)** — Guard browser Back/Forward (**first**)
  - Files: `UnitPlaceContext.tsx` only (Provider owns trap — **not** Chrome)
  - Keep `dirtyRef` (+ key snapshot) synced from `dirtyMap`
  - On `popstate`: **synchronously** `history.pushState` back to current unit URL, then open existing ConfirmDialog from the ref — never gate on post-unmount React `isDirty`
  - **Cancel** → stay on unit, dialog closes, sentinel remains while dirty
  - **Discard** → `requestDiscard()` then allow the history step
  - Sections still clear dirty on unmount — that is why the ref exists
  - Verify (manual Friday-2am): dirty Place + browser Back → dialog; Cancel stays; Discard leaves

- [ ] **R1 (P1, CC: ~15min)** — Dirty dialog names the dirty section(s)
  - Files: `UnitPlaceContext.tsx` ConfirmDialog (~L166–L177)
  - Live dirty keys are exactly `"place"` and `"products"` (verified)
  - Pure helper `dirtySectionLabels`: `place`→`Place`, `products`→`Products`
  - One key → title `Unsaved {Label} edits`; many → `Unsaved edits` + body lists labels
  - Re-enrich body reuses the same label list
  - Verify: dirty Products only → title uses Products, not Place alone

- [ ] **R3 (P2, CC: ~20min)** — Enricher poll backoff + pause when hidden
  - Files: `UnitEditChrome.tsx:75-94`
  - Single scheduler: cadence = enriching (running/queued/generating) ? 8s : ~60s
  - Clear+reschedule when enriching or `visibilitychange` flips
  - No poll while `document.hidden`; resume on visible
  - Verify: Network shows 8s while enriching, ~60s idle, zero while hidden

- [ ] **R4 (P2, CC: ~10min)** — Tab chrome is a nav, not an ARIA tab widget
  - Files: `UnitEditChrome.tsx:251-288`
  - Drop `role="tablist"` / `role="tab"`; `<nav>` + `aria-current="page"` on active only
  - Keep Link + `guardNav` + existing underline indicator
  - Verify: axe — no orphan tablist without tabpanels

- [ ] **R5 (P2, CC: ~15min)** — Overflow affordance at ~375px
  - Files: `UnitEditChrome.tsx` nav (~L254)
  - Right-edge fade over the nav (`pointer-events-none`, ~24–32px, `from-background` → transparent)
  - Hide fade when `scrollLeft + clientWidth >= scrollWidth - 1`
  - No chevron button
  - Verify: 375px — Admin tab discoverable via scroll+fade

- [ ] **R6 (P1, CC: ~45min)** — Vitest pins pure helpers (node env — no RTL)
  - Extract `legacyTabTarget(head)` used by `[...slug]/page.tsx` (team→settings, reviews|reservations→performance, else→place)
  - Pin `isUnitSection` / `parseUnitId` / frozen `UNIT_TAB_SECTIONS` ids
  - Pin `dirtySectionLabels` + `shouldTrapPopstate(dirtyRef)` decision helpers
  - **Do not** add jsdom/RTL to claim popstate coverage — Back→dialog stays manual
  - Verify: `pnpm test` green in CI

- [ ] **R7 (P3, CC: ~10min)** — Team load error gets Retry
  - Files: `TeamSection.tsx` (~L179)
  - ErrorNote + Retry calling `load()`; Spinner while retrying; hide invite/list until snap when errored
  - Verify: forced load failure → Retry re-invokes `load()`

- [ ] **R8 (P2, CC: ~35min)** — Completeness chips actionable (chip→action table)
  - Files: `ProfileCompleteness.tsx`, `ui.tsx` (`SectionCard` optional `id`), Place card wrappers
  - Chips = `<button type="button">` keeping amber styles; `aria-label` = hint
  - **Chip → action (locked):**
    | Chip | Action |
    |---|---|
    | Basics / Hours / Channels / Photos / … on Place | `scrollIntoView` + focus card heading; `scroll-margin-top` ≥ sticky chrome |
    | Menu | in-page focus Products `#products` on `/place` — **never** navigate to `/products` |
    | Reservations | `guardNav` / `CrossTabLink` → Settings (editor is `ReservationsCard`) |
    | Missing target | no silent no-op — `aria-live` “Section unavailable” |
  - Verify: Menu → Products in view; Reservations → Settings (guarded if dirty)

- [ ] **R9 (P3, CC: ~5min)** — Delete unreachable PageHeader branch
  - Files: `ManageSingleLayoutShell.tsx:32-40`
  - Verify: unit/select/create/add still covered by early returns

---

# /autoplan — CEO Review (Phase 1)

**Mode:** SELECTIVE EXPANSION requested by /autoplan → **executed as SCOPE REDUCTION** because the plan’s baseline target was invalid (USER CHALLENGE). Hierarchy: Pato live MESITA-900 > prior eng/design clearance of obsolete IA.

**Premise gate (auto-decided under Mesita NEVER-ask + Pato live instruction):**
- Reject premises that assume Scores/Team tabs or Products/Reviews top-level routes.
- Accept rewrite to residual polish against live `UNIT_TAB_SECTIONS`.
- Log: `decision: plan manage-single-tabs superseded by live nav; residual = polish only`.

## 0A. Premise challenge

| Premise | Verdict | Notes |
|---|---|---|
| Today = Place·Promos·Scores·Team | **FALSE** | Live = Place·Promos·Performance·Settings·Admin |
| Scores = `"Soon."` | **FALSE** | `ScoresCard` is real Admin UI |
| Need Products/Reviews page flip | **FALSE** | Nested/folded; catch-all redirects exist |
| E1 guard lift still needed | **FALSE** | Already in context + `CrossTabLink` |
| E2 performance id collision | **FALSE** | `performance` is live |
| E3 first Vitest infra | **FALSE** | Vitest + CI already ship |
| Tab reshuffle improves ops | **CHALLENGED** | Admits no declutter; fights Pato IA |

## 0B. Existing code leverage

| Sub-problem | Existing code |
|---|---|
| Dirty nav intercept | `UnitPlaceContext.guardNav` / `guardIntent` / `ConfirmDialog` |
| Cross-tab links | `CrossTabLink` |
| Legacy URLs | `[...slug]/page.tsx` |
| Tests | `promo-state.test.ts` pattern + CI |
| Team errors | `ErrorNote`; shell Retry as reference |
| Completeness | `ProfileCompleteness` + `menusFromPlace` |

## 0C. Dream state

```
CURRENT (MESITA-900 shell, residual gaps)
  → THIS PLAN (edit-loss + poll cost + a11y + small empty/error polish)
  → 12-MONTH IDEAL (Place density solved; completeness drives enrichment;
     Performance truthfulness; business-console parity; DESIGN.md)
```

Delta after this plan: operators stop losing edits on Back; Enricher EF burn drops when idle; chrome a11y honest; Team Retry works. Place density unchanged.

## 0C-bis. Implementation alternatives

| Approach | Effort | Risk | Pros | Cons |
|---|---|---|---|---|
| A. Residual polish only (chosen) | CC ~2–3h | Low | Honors Pato IA; ships real gaps | Doesn’t fix Place density |
| B. Re-split Products/Reviews tabs | CC ~1–2d | High | Matches obsolete plan | Regresses MESITA-900 |
| C. Place declutter project | CC ~1d+ | Med | Highest ops leverage | Separate scope; needs own design pass |

**Choice: A** (P1 completeness of *valid* problem + P5 explicit + Pato hierarchy). B rejected. C → TODOS.

## 0D–0F. Mode / temporal

- Hour 1: R1+R4+R9 (small, safe).
- Hour 2–3: R2+R6 (guard + tests — load-bearing).
- Hour 4: R3+R5+R7+R8.
- Hour 6+: if still itching for density → stop; open Place declutter issue, don’t widen this PR.

## CEO dual voices

### CLAUDE SUBAGENT (CEO — strategic independence)
8 findings. Verdict: **KILL IA reshuffle.** Critical: stale premises, wrong problem, would undo MESITA-900. Residual list matches R1–R9 above.

### CODEX SAYS (CEO — strategy challenge)
`[codex-unavailable: binary not found]` — single-model mode (`[subagent-only]`).

### CEO DUAL VOICES — CONSENSUS TABLE
```
═══════════════════════════════════════════════════════════════
  Dimension                            Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   NO      N/A    REJECTED
  2. Right problem to solve?           NO*     N/A    REFRAME
  3. Scope calibration correct?        NO      N/A    REDUCE
  4. Alternatives explored?            WEAK    N/A    FIXED via rewrite
  5. Competitive/market risks covered? OK      N/A    OK (internal tool)
  6. 6-month trajectory sound?         NO if shipped as-was / YES if residual
═══════════════════════════════════════════════════════════════
* Right residual problem: edit-loss + poll cost + a11y — not tab count.
USER CHALLENGE: both-would-agree (Claude alone) — do not ship old IA.
Resolved by Pato live MESITA-900 (hierarchy), not by taste.
```

## Section 1: Architecture

Residual work stays inside existing shell. No new routes, EFs, or schema.

```
UnitEditShell
  └─ UnitPlaceProvider (dirtyMap, guardNav, dialog)
        ├─ UnitEditChrome (tabs nav, enrich poll, beforeunload)
        └─ page routes
              place → PlaceSection + ProductsSection + ProfileCompleteness
              promos → PromosSection
              performance → Headline + ReputationStrip + Events + Reservations
              settings → SettingsSection (+ TeamSection)
              admin → AdminSection (+ ScoresCard, …)
```

Coupling: R1/R2 deepen context responsibility (correct — guard already lives there).
Rollback: git revert; no migrations.

## Section 2: Error & Rescue Registry

| Codepath | Can go wrong | Rescued? | User sees |
|---|---|---|---|
| Enrich poll `getPlaceEnrichment` | EF error | Partial (`enrichPollError`) | Existing chrome flag |
| Team `load()` | EF error | ErrorNote today; **Retry GAP → R7** | Message + Retry |
| popstate while dirty | Silent loss today | **GAP → R2** | Dialog |
| Completeness chip click | Missing scroll target | **GAP → R8** | No-op chip |

## Section 3: Security

No new attack surface. Admin-only console; existing EF ACLs unchanged. No new deps required for R1–R5/R7–R9. Optional RTL is test-only. **No issues beyond standard XSS hygiene already in place.**

## Section 4: Interaction edge cases

| Interaction | Edge | Plan |
|---|---|---|
| Browser Back | Dirty form | R2 dialog |
| Tab click | Dirty form | Existing `guardNav` |
| Refresh/close | Dirty form | Existing `beforeunload` |
| Hidden tab | Enrich poll | R3 pause |
| 375px width | 5th tab clipped | R5 cue |
| Completeness chip | Card has no `id` | R8 add ids |

## Section 5: Code quality

- Prefer extending `UnitPlaceContext` over re-adding local `guardNav` in Chrome.
- Dirty title: don’t hardcode “Place”; read `dirtyMap`.
- Avoid new `place-cards/` module — that served the dead split.
- Don’t reintroduce `soon` gates.

## Section 6: Test review

```
NEW UX: popstate dirty dialog; named dirty sections; Team Retry; chip scroll
NEW CODEPATHS: pushState sentinel; poll backoff scheduler; nav a11y roles
NEW TESTS: redirect map; parseUnitId/isUnitSection; dirty label helper; popstate decision
```

Friday-2am test: dirty Place → Back → dialog appears; Discard leaves; Cancel stays.
Hostile QA: dirty clears on unmount before popstate — R2 must document sentinel.

## Section 7: Performance

R3 is the performance win (cut idle Enricher EF chatter). No N+1 / index work. EventSuperBoxes intervals unrelated — leave alone.

## Section 8: Observability

Admin internal tool. No new dashboards. Rely on existing EF logs for enrich poll. Optional: `console.debug` gated — skip; not Mesita style.

## Section 9: Deployment

Frontend-only. Vercel web-admin path filter. No feature flag needed. Rollback = revert PR.

## Section 10: Spec completeness

Residual tasks R1–R9 are file-concrete with verify steps. Place density explicitly deferred with rationale.

## Section 11: Design (CEO pass)

Hierarchy already set by MESITA-900. Residual design work is a11y honesty (R4), overflow discoverability (R5), and actionable completeness (R8). No new visual language.

## CEO Completion Summary

| Item | Result |
|---|---|
| Premises | Rejected / rewritten |
| Mode | Scope reduction to residual polish |
| Expansions accepted | None (density → TODOS) |
| Expansions deferred | Place declutter; Performance Retry; products lost-update |
| Ready for Design/Eng/DX on residual plan? | Yes |

**Phase 1 complete.** Codex: unavailable. Claude subagent: 8 issues (IA kill). Consensus: reframe. Premise gate: passed via Pato live IA + Mesita autonomy.

---

# /autoplan — Design Review (Phase 2)

## Focus
Chrome a11y, overflow, dirty-dialog copy, completeness chips — against live shell.

## CLAUDE SUBAGENT (Design) — 8 findings
1. **critical** — Completeness chips need locked chip→action table (Reservations → Settings, not Place).
2. **critical** — Browser Back journey UX blank (Cancel/Discard/sentinel) — now specified in R2.
3. **high** — Dirty dialog label map + multi-section body — locked in R1 (`place`/`products`).
4. **high** — Chips must be real `<button>`s with scroll-margin under sticky chrome.
5. **high** — Overflow fade must specify side, size, hide-when-scrolled — locked in R5.
6. **medium** — State matrix gaps (chip miss, cross-tab dirty) — folded into R8.
7. **medium** — Team Retry composition with invite UI — tightened in R7.
8. **medium** — R4 must keep Link+guardNav + scroll-margin for chip focus — in R4/R8.

## CODEX SAYS (Design)
`[codex-unavailable]`

## Design dimensions (post-fix)

1. **Information hierarchy** — Tabs frozen. Completeness banner stays secondary; chips become actionable without inventing a sixth tab.
2. **States** — R1/R2/R5/R7/R8 now specify Cancel/Discard, fade hide rule, Team retry, chip miss.
3. **Responsive** — R5 right-edge fade at 375px.
4. **A11y** — R4 honest nav; R8 buttons + aria-live miss path.
5. **Specificity** — Label map and chip→action table locked.
6. **Taste** — Edge fade (not chevron) — TASTE, default accepted.
7. **DESIGN.md** — Still missing (TODOS); does not block.

**Design score (residual plan): 8.5/10** after incorporating dual-voice fixes into R1/R2/R5/R8.

**Phase 2 complete.**

---

# /autoplan — Eng Review (Phase 3)

## CLAUDE SUBAGENT (Eng) — 8 findings
1. **critical** — popstate needs `dirtyRef` + sync pushState in Provider (not Chrome) — R2 rewritten.
2. **high** — R8 must not create Products navigation — chip table locked; Reservations → Settings.
3. **high** — Dirty keys are exactly `place`/`products` — R1 locked.
4. **high** — Sentinel must not live in Chrome — R2 Provider-only.
5. **medium** — R6 node Vitest: pure helpers only; popstate manual — R6 rewritten.
6. **medium** — Order R2 before R1/R6 — build order updated.
7. **medium** — Poll scheduler must reschedule on enriching/visibility — R3 tightened.
8. **medium** — Freeze `UNIT_TAB_SECTIONS` + `legacyTabTarget` in tests — R6.

## CODEX SAYS (Eng)
`[codex-unavailable]`

## Eng findings (merged)

| # | Finding | Severity | Decision |
|---|---|---|---|
| E1 | popstate vs unmount dirty clear | critical | R2: dirtyRef + sync pushState in Provider |
| E2 | Dirty keys `place`/`products` | high | R1 helper locked |
| E3 | Poll backoff while enriching | high | R3: 8s while enriching only |
| E4 | R8 Reservations is Settings | high | Chip→action table |
| E5 | No RTL for popstate claims | medium | R6 pure helpers + manual |
| E6 | R2 before R1/R6 | medium | Build order |
| E7 | Keep Link guardNav on R4 | medium | Spec’d |
| E8 | Freeze tab catalog in tests | medium | R6 |

**Eng verdict: CLEAR (residual plan)** — implementable after R2/R8 hardenings landed in the plan text.

**Phase 3 complete.**

---

# /autoplan — DX Review (Phase 3.5)

| Finding | Decision |
|---|---|
| “First Vitest” narrative would mislead | Kill; extend existing |
| Extract `legacyTabTarget()` for testability | Accept (P5) |
| Don’t claim popstate covered without jsdom | Accept — manual verify |
| Comments already document MESITA-900 | Leave; freeze in tests |

**DX verdict: CLEAR**

**Phase 3.5 complete.**

---

## Decision Audit Trail (/autoplan)

| ID | Phase | Decision | Principle | Type |
|---|---|---|---|---|
| D1 | CEO | Kill IA reshuffle; freeze MESITA-900 tabs | Pato hierarchy + P1/P5 | USER CHALLENGE → resolved by live instruction |
| D2 | CEO | Choose residual polish (alt A) over re-split (B) | P3/P5 | Mechanical |
| D3 | CEO | Defer Place density to TODOS | P3 | Mechanical |
| D4 | CEO | Skip /office-hours (no design doc) | P6 + Mesita never-ask | Mechanical |
| D5 | Design | Overflow = right-edge fade (not chevron) | P5 | Taste |
| D6 | Design | Chip→action table incl. Reservations→Settings | P1 | Mechanical |
| D7 | Eng | dirtyRef + Provider-owned popstate trap | P1/P5 | Mechanical |
| D8 | Eng | Extract `legacyTabTarget` + pure dirty helpers | P5 | Mechanical |
| D9 | Eng | R2 before R1/R6 | P3 | Mechanical |
| D10 | DX | No greenfield Vitest/RTL ceremony | P4 | Mechanical |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` Phase 1 | Scope & strategy | 1 | **REFRAME** | Stale IA killed; residual R1–R9 |
| Codex Review | dual voice | Independent 2nd opinion | 0 | `[codex-unavailable]` | — |
| Design Review | `/autoplan` Phase 2 | UI residual | 1 | CLEAR | 8 dual-voice findings → plan fixes |
| Eng Review | `/autoplan` Phase 3 | Architecture & tests | 1 | CLEAR | 8 dual-voice findings → plan fixes |
| DX Review | `/autoplan` Phase 3.5 | Test/redirect DX | 1 | CLEAR | extend Vitest; extract redirect helper |

- **CROSS-MODEL:** Codex CLI missing — `[subagent-only]`. Claude CEO/Design/Eng voices ran; primary review verified against `nav.ts` + route tree + dirty keys.
- **USER CHALLENGE:** Do not ship Place·Products·Promos·Reviews·Team. Resolved by Pato MESITA-900 (2026-08-05).
- **TASTE at gate:** Overflow = right-edge fade (D5). Accept unless overridden.
- **VERDICT:** Residual polish plan ready to implement. Old Eng/Design clearance of the tab reshuffle is **void**.

NO UNRESOLVED DECISIONS (relative to residual plan)

---

## Degradation matrix

| Voice | Status |
|---|---|
| Codex CEO / Design / Eng | `[codex-unavailable: binary not found]` |
| Claude CEO / Design / Eng subagents | ran |
| Mode | `[subagent-only]` |
