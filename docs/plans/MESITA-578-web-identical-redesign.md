<!-- /autoplan restore point: /home/ubuntu/.gstack/projects/canzeco-mesita-monorepo/main-autoplan-restore-20260712-030430.md -->
# Plan: MESITA-578 — mobile-consumer web-identical redesign (retire react-native-paper)

**Issue:** [MESITA-578](https://linear.app/canzeco/issue/MESITA-578)  
**Parent parity epic:** [MESITA-564](https://linear.app/canzeco/issue/MESITA-564)  
**Status at review:** Slice 1/5 ([MESITA-579](https://linear.app/canzeco/issue/MESITA-579)) **Done** (PR #128). Slices 2–5 in Backlog.  
**Package:** `apps/mobile-consumer`  
**Branch (this review):** `cursor/autoplan-mesita-578-system-2823`  
**Review:** `/autoplan` (CEO → Design → Eng → DX) · Codex unavailable · Claude subagent voices only · **APPROVED** (cloud/Mesita autonomy — premises + final gate auto-accepted)

---

## Problem

Mobile consumer sits below web-parity on chrome. Tokens, radius, fonts, and custom composites (Swipe / Ask AI / Social / Favorites / Search shell / Place / Me-hero) already track web. The remaining gap is **react-native-paper (Material Design 3)** on Me, Rewards, Reservations, Search sheets/panels, sign-in/onboard, and tab/shell treatment.

Pato (2026-07-11) superseded "similar-not-identical": mobile must look **very alike** to web-consumer with feature parity. MESITA-578 reverses the #121/#122 "Paper is the kit" hard-constraint.

## Goal

Port web-consumer's existing design system into mobile: NativeWind semantic classes + targeted `@rn-primitives` for a11y (Portal / Switch / Slot), then delete Paper. Not a new invention — a 1:1 port of named web files.

## Premises (confirmed)

| # | Premise | Verdict |
|---|---------|---------|
| P1 | MD3 Paper chrome is the dominant remaining visual gap for Me/Rewards/Reservations/tab/auth/search sheets | **Accepted** — inventory confirms Paper on those surfaces; feature gaps (567/568/570) are separate epics |
| P2 | Drop Paper → NativeWind + `@rn-primitives` (Pato-locked) | **Accepted** — do not re-litigate kit choice |
| P3 | Keep Memo + Social **live** on mobile; adopt web nav styling + "Memo" name only | **Accepted** |
| P4 | Five child issues, one PR each, CI gates | **Accepted** — with ownership amendments below |
| P5 | No Stripe/subscribe in iOS binary | **Accepted** |

---

## Decisions already locked

1. Drop `react-native-paper` → NativeWind + `@rn-primitives`.
2. One branch / worktree / squash PR per child issue.
3. Gate every PR: `pnpm typecheck` · `pnpm lint` · `npx expo export --platform web` + `:8081` glance.
4. Memo + Social stay live.
5. Governance rewrite lands **before further Paper-free chrome ships** (amended — was slice 5 only).

---

## Amendments from /autoplan (must land in Linear + code)

### A1 — Governance flip NOW (critical)
`apps/mobile-consumer/CLAUDE.md` still mandates Paper + "similar-not-identical". Agents will re-add Paper mid-epic.

**Required:** First commit of [MESITA-583](https://linear.app/canzeco/issue/MESITA-583) (or a tiny Ops PR before it) rewrites the hard constraint to:
- Default kit = NativeWind semantic classes + targeted `@rn-primitives`
- Web parity = **very alike** (MESITA-564 / user rule)
- No new `react-native-paper` imports; migrate only
- Run `deno task sync-rules` so `AGENTS.md` matches

Notion Product/Dev rule mirror can stay with MESITA-582 if needed, but **package CLAUDE must flip first**.

### A2 — Own every Paper import file (critical)
| File | Owning slice |
|------|----------------|
| `(tabs)/me.tsx` | MESITA-583 |
| `(tabs)/rewards.tsx`, `(tabs)/reservations.tsx` | MESITA-580 |
| `(tabs)/_layout.tsx` (tab bar) | MESITA-581 |
| `sign-in.tsx`, `onboard.tsx` | **MESITA-582** (named Auth migration, before uninstall) |
| `GooglePlaceSheet.tsx`, `SearchResultsPanel.tsx` | **MESITA-582** (named Search chrome migration, before uninstall) |
| `_layout.tsx` PaperProvider, `paper-theme.ts`, dep delete | MESITA-582 last |

Slice 5 is **not** a dumpster: migrate Auth+Search → grep-clean → uninstall → eslint ban → Notion sync → a11y sweep.

### A3 — Real UI kit before Me polish (high)
MESITA-579 shipped `SegmentNav` only — not a foundation. First part of MESITA-583 installs and proves:

`@rn-primitives/portal` · `@rn-primitives/switch` · `@rn-primitives/slot` (pin versions)

Plus `src/components/ui/`: `PortalHost` · `BottomSheet`/`FullScreenSheet` · `TextField` · `Button` · `Switch` · `TintedIconTile` · `BoxShell`/`BoxRow`

Mount `<PortalHost />` replacing `PaperProvider` order carefully under `GestureHandlerRootView`. Prove one sheet on web-export before bulk Me migration.

### A4 — Design locks (high)
1. **Me row order** (web verbatim): Identity hero → Instagram → Class → Personal → Settings → Share → AI → Contact → Sign out. Drop mobile "Me" H1. Class box stays visible (Soon chrome OK; no subscribe CTA in binary).
2. **Hero** = port of web `ProfileSummaryCard` DNA (story-ring, Fraunces name, phone, meta, IG + Class data rows). No Paper Chip.
3. **Soon dialect:** Me boxes = Soon pill + inert (no `Alert.alert`). Tabs = ComingSoon modal or branded empty screen — pick one rule; kill Alert.
4. **Tab chrome ≠ SegmentNav:** Web `BottomNav` = top hairline + `bg-primary/10` icon ring + `Me · Free|Premium` — **not** the Home pink filled pill.
5. **Rewards (MESITA-580):** Keep issue intent — build coral `MyQrCard` passport (prepares unpark). Document intentional divergence: web parks Rewards at nav; mobile may show passport on the Rewards route. Prefer mock/static QR if pay EF not wired; do not invent subscribe.
6. **Reservations:** Port segmented Upcoming/History + pink-gradient empty (not a restyled Paper Card).
7. **Fraunces:** Load discrete weights used (600+700), not "variable font" marketing language.

### A5 — States matrix (minimum)
| Surface | Required states |
|---------|-----------------|
| Me identity | Skeleton hero; profile null → Personal disabled; save loading/error |
| Me Soon rows | Inert + Soon pill (no Alert) |
| Sheets | Dismiss, Android back, keyboard avoid, save error |
| Rewards | Loading / no-code / copy success / zero stats |
| Reservations | Empty Upcoming + empty History copy |
| Tabs | Soon intercept; `consumerClass` null → `Me · Free` |
| Auth | OTP error; onboard validation |

---

## Rollout (remaining)

| # | Issue | Scope | Priority |
|---|-------|-------|----------|
| 1 | MESITA-579 | Home `SegmentNav` pilot | **Done** |
| 2 | MESITA-583 | Governance flip + UI kit + Me port | High |
| 3 | MESITA-580 | Rewards `MyQrCard` + Reservations empty | Medium |
| 4 | MESITA-581 | Custom tab bar (hairline/ring) + shell gradients + Fraunces weights | Medium |
| 5 | MESITA-582 | Auth + Search Paper migration → remove Paper + MCI transitive → lint ban → Notion → a11y | Medium |

---

## What already exists (leverage)

- Web Me: `apps/web-consumer/src/app/(shell)/profile/ProfileClient.tsx` (`BOX_TINT`)
- Web tab bar: `apps/web-consumer/src/components/consumer/BottomNav.tsx`
- Web Rewards passport: `apps/web-consumer/src/components/consumer/MyQrCard.tsx`
- Mobile SegmentNav: `apps/mobile-consumer/src/components/ui/SegmentNav.tsx`
- Mobile brand tokens: `apps/mobile-consumer/src/constants/brand.ts`

## Architecture (ASCII)

```
[web ProfileClient / BottomNav / MyQrCard / HomeModeNav]
        |                |                 |
        v                v                 v
 +--------------+  +---------------+  +------------------+
 | ui kit (NEW) |  | shell (581)   |  | screens          |
 | SegmentNav*  |  | CustomTabBar  |  | me (583)         |
 | TintedIcon   |  | ComingSoon    |  | rewards (580)    |
 | BoxShell/Row |  | PortalHost**  |  | reservations(580)|
 | Button/Field |  | Fraunces+Inter|  | sign-in (582)    |
 | Switch/Sheet |  +-------+-------+  | onboard (582)    |
 +------+-------+          |          | Search* (582)    |
        +------------------+----------+
                           |
                    brand.ts / AuthProvider / lucide / LinearGradient
 * exists   ** replaces PaperProvider
```

## NOT in scope

- Place-detail 4-tab (MESITA-567), Inbox (570), Me feature modules beyond chrome (568)
- NativeWind v5 / gluestack
- App Store submit
- Backend / EF / schema

## Deferred to TODOS / follow-ups

- Shared cross-app component package (web↔mobile) — multi-quarter; out of blast radius
- Automated Detox/Maestro suite — defer; manual matrix below for now
- Align SegmentNav with live web HomeModeNav solid primary vs CSS pink utility — low; pick one source later

---

## Error & Rescue Registry

| Error | User sees | Rescue |
|-------|-----------|--------|
| PortalHost missing after PaperProvider removal | Blank sheets | Keep PortalHost in root; never remove PaperProvider until last Paper Portal gone |
| Font load fail | Infinite splash | Only gate on required faces; fail soft log |
| `@rn-primitives` Metro resolve fail | Export/typecheck red | Install in package root (hoisted); Slot/cssInterop wrappers |
| Profile null | Crash on Me edit | Keep `disabled={!profile}` |
| OTP/network | Auth stuck | Preserve error HelperText / retry |

## Failure Modes Registry

| Mode | Severity | Mitigation |
|------|----------|------------|
| Agents re-add Paper mid-epic | Critical | A1 governance + eslint ban in 582 |
| Slice 5 absorbs Auth/Search redesign | Critical | A2 named ownership |
| Dual DS drift after ship | High | Port from named web files; screenshot checklist |
| Web-export green, device broken (Portal/tab) | High | Human TestFlight note; Portal proof early |
| Subscribe CTA sneaks into Class box | High | Apple rule; Class = Soon/status only |
| Kit rewrite again at NativeWind v5 | Medium | Accepted risk; log decision |

---

## Dream state delta

```
CURRENT          THIS PLAN              12-MONTH IDEAL
───────          ─────────              ──────────────
Paper MD3 chrome → NativeWind twin of   → Shared tokens/package;
~6.5 glance        web chrome; Paper      NW5/gluestack optional;
Memo/Social live   gone; Memo live        full feature parity
CLAUDE says Paper  CLAUDE says twin       One DS story
```

---

## Implementation alternatives (CEO 0C-bis)

| Approach | Effort | Risk | Pros | Cons |
|----------|--------|------|------|------|
| A. NativeWind + rn-primitives port (chosen) | Medium | Portal/Metro | Matches web DNA; Pato-locked | Hand port; dual maintain |
| B. Restyle Paper harder | Low | Cap at "Material-ish" | Fast | Fails very-alike bar |
| C. Wait NativeWind v5 + gluestack | High wait | Blocked | Better kit later | Blocks parity now |

**Selected: A** (P2/Pato). Alternatives B/C rejected with `decision:` rationale above.

---

## Phase reviews

### Phase 1 — CEO (SELECTIVE EXPANSION)

**CODEX SAYS (CEO):** `[codex-unavailable]` — no Codex CLI/auth in cloud VM.

**CLAUDE SUBAGENT (CEO):** Critical gaps on Auth/Search ownership, governance lag, overstated foundation, Rewards priority vs Auth/Search, assumed 6.5/10 score.

**CEO DUAL VOICES — CONSENSUS TABLE:**

| Dimension | Claude | Codex | Consensus |
|-----------|--------|-------|-----------|
| 1. Premises valid? | Partial — score/foundation soft | N/A | DISAGREE→amended with evidence |
| 2. Right problem? | Direction yes; framing chrome-debt | N/A | CONFIRMED (direction) |
| 3. Scope calibration? | Incomplete (Auth/Search) | N/A | DISAGREE→A2 |
| 4. Alternatives explored? | Weak | N/A | Amended (table above) |
| 5. Competitive risks? | Opportunity cost | N/A | CONFIRMED |
| 6. 6-month trajectory? | Dual-DS / agent Paper risk | N/A | CONFIRMED→A1 |

Consensus: **3/6 confirmed**, **3 amended**. No User Challenge against Pato kit decision.

### Phase 2 — Design

**Litmus (Claude subagent):** Hierarchy 3 · States 1 · Journey 3 · Specificity 2 · Native 2 · A11y 2 · Brand 4 → **overall ~2.4 as brief; raised by A4/A5 locks.**

**CODEX:** `[codex-unavailable]`

**Design consensus:** Tab hairline vs pill, Me order, Soon dialect, Rewards park tension, missing states — all folded into A4/A5.

**Taste — Rewards passport vs web parking:** Keep MESITA-580 passport (user/Linear direction). Document nav-parking divergence.

### Phase 3 — Eng

**CODEX:** `[codex-unavailable]`

**CLAUDE SUBAGENT (Eng):** Same ownership/governance/kit gaps; Fraunces variable myth; custom tab bar required; zero automated tests; PortalHost fragility.

**ENG DUAL VOICES — CONSENSUS TABLE:**

| Dimension | Claude | Codex | Consensus |
|-----------|--------|-------|-----------|
| 1. Architecture sound? | Weak until kit | N/A | → A3 |
| 2. Test coverage? | Gates only | N/A | → test plan artifact |
| 3. Performance risks? | Low (UI) | N/A | CONFIRMED |
| 4. Security? | Low | N/A | CONFIRMED |
| 5. Error paths? | Under-specified | N/A | → A5 + Error registry |
| 6. Deploy risk? | Manageable | N/A | CONFIRMED |

### Phase 3.5 — DX (agent/package rules)

Product is consumer app, but this epic **is** developer-facing for Mesita agents (CLAUDE.md is the kit law).

| Dimension | Score | Note |
|-----------|------:|------|
| Getting started / agent onboarding | 3→9 | After A1, next agent reads correct kit |
| Naming guessable | 7 | Slice titles clear once Auth/Search named |
| Error messages | 6 | Expo export failures are opaque; keep grep gate |
| Docs findable | 5→8 | This plan in `docs/plans/` + Linear |
| Upgrade path | 6 | Paper→NativeWind one-way; eslint ban |
| Dev env friction | 5 | PortalHost proof required early |
| Escape hatches | 7 | Composites stay custom |
| Magical moment | 8 | Side-by-side twin screens |

**TTHW (agent):** Was ~15 min of conflicting rules → target **&lt;5 min** after CLAUDE flip + this plan link on MESITA-578.

---

## Test plan artifact

Canonical copy: `docs/plans/MESITA-578-test-plan.md` (also mirrored under `~/.gstack/projects/...`).

### Test diagram (codepaths → coverage)

| Codepath | Type | Exists? | Action |
|----------|------|---------|--------|
| SegmentNav tab roles / active style | Manual + glance | Partial (579) | Keep |
| Me BoxRow order + Soon inert | Manual screenshot vs ProfileClient | No | Add per 583 |
| Me sheet save/error/keyboard | Manual | No | Add per 583 |
| Settings Switch persist | Manual | No | Add per 583 |
| Rewards MyQrCard / empty | Manual | No | Add per 580 |
| Reservations empty segments | Manual | No | Add per 580 |
| Custom tab bar hairline + Me·class | Manual | No | Add per 581 |
| Tab soon intercept | Manual | No | Add per 581 |
| Auth OTP error / onboard validation | Manual | Partial | Add per 582 |
| Search sheet/results without Paper | Manual | No | Add per 582 |
| Grep no paper imports | CI/script | No | Add in 582 |
| typecheck · lint · expo export | CI | Yes | Keep every PR |
| Memo/Social still live | Manual | Yes | Regression every Home PR |
| Device Portal/tab (TestFlight) | Human | N/A | Note only |

---

## Success criteria (amended)

- [ ] CLAUDE.md / AGENTS.md no longer prescribe Paper (A1)
- [ ] No `react-native-paper` imports; no PaperProvider; `paper-theme.ts` gone
- [ ] Eslint (or CI grep) bans reintroduction
- [ ] Me / tab / Rewards / Reservations / Auth / Search chrome match named web counterparts on screenshot checklist
- [ ] Memo + Social remain live
- [ ] Each slice green on typecheck · lint · expo export

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | 0 | Reconstruct plan from MESITA-578 (no CLAUDE_PLAN_FILE) | Mechanical | P6 | Cloud launch had only `/autoplan`; active system redesign is 578 | Abort / ask |
| 2 | 0 | UI scope yes; DX scope yes (agent kit rules) | Mechanical | P1 | 7 UI + 2 DX keyword hits | Skip design/DX |
| 3 | 1 | Mode SELECTIVE EXPANSION | Mechanical | P2 | Epic mid-flight; expand blast-radius gaps only | Full rewrite / reduce |
| 4 | 1 | Accept premises P1–P5 | Mechanical | P6 | Pato-locked + evidence | Challenge kit choice |
| 5 | 1 | A1 governance flip before/with 583 | Mechanical | P2/P5 | CLAUDE still mandates Paper | Wait until 582 |
| 6 | 1 | A2 Auth+Search owned by 582 | Mechanical | P1 | Inventory orphans blocked success criteria | New issues only / ignore |
| 7 | 1 | Keep 5-slice shape; expand 582 | Pragmatic | P3 | Avoid ledger churn from cloud | Split 2 new issues now |
| 8 | 1 | Kit choice NativeWind+rn-primitives stays | Mechanical | Pato | Already decided | Restyle Paper / wait gluestack |
| 9 | 2 | Lock Me order + hero DNA | Mechanical | P5 | Web ProfileClient is source | Invent mobile order |
| 10 | 2 | Tab = hairline/ring not pink pill | Mechanical | P5 | BottomNav ≠ SegmentNav | Copy SegmentNav to tabs |
| 11 | 2 | Keep MyQrCard in 580 | Taste | User direction | Linear issue says build passport; web parks nav | Park-only Rewards |
| 12 | 2 | Soon = pill inert on Me; kill Alert | Mechanical | P1 | Match web dialect | Keep Alert |
| 13 | 3 | A3 UI kit first in 583 | Mechanical | P1/P5 | SegmentNav ≠ foundation | Ad-hoc inside me.tsx |
| 14 | 3 | Pin rn-primitives portal/switch/slot | Mechanical | P5 | Explicit over vague | "Add primitives later" |
| 15 | 3 | Fraunces discrete weights not variable | Mechanical | P5 | Expo font reality | Fake "variable" |
| 16 | 3 | Custom tabBar required in 581 | Mechanical | P5 | Expo Tabs can't do web chrome | Tint-only default Tabs |
| 17 | 3 | Manual test matrix; no Detox now | Pragmatic | P3 | Zero tests today; boil later | Block on full E2E |
| 18 | 3.5 | Treat CLAUDE rewrite as DX magical moment | Mechanical | P1 | Agents are primary consumers of kit law | Skip DX |
| 19 | 4 | Auto-approve plan (cloud + Mesita NEVER ask) | Mechanical | P6 | Only needs-human is secrets/money | Wait for interactive gate |

---

## GSTACK REVIEW REPORT

| Field | Value |
|-------|-------|
| Skill | `/autoplan` |
| Status | **APPROVED** (autonomous) |
| Plan | `docs/plans/MESITA-578-web-identical-redesign.md` |
| CEO | Amended — governance + Auth/Search ownership |
| Design | Amended — hierarchy/states/tab/Soon locks |
| Eng | Amended — kit + PortalHost + test matrix |
| DX | Amended — agent CLAUDE flip |
| Codex | Unavailable all phases (`[codex-unavailable]`) |
| Voices | `subagent-only` |
| Taste decisions | 1 (Rewards passport kept per Linear) |
| User challenges | 0 (kit decision already Pato-locked) |
| Next | Claim MESITA-583; land A1+A3 first; implement Me port |

**Exit plan mode gate:** This file ends with `## GSTACK REVIEW REPORT` ✓
