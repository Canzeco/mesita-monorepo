# Mobile-consumer → web-consumer front-end parity — execution plan (v2, reviewed)

**Mandate (Pato, live):** advance `apps/mobile-consumer` to be as functional as `apps/web-consumer`. **Mirror the consumer web app — the UI web SHOWS, not invisible internals.** This session changes **front-end code only** (no EF / Supabase / DB / backend).

**Base:** `agent/mobile-fe-parity` **rebased onto current `origin/main` `eef07147`** (was 4 behind; the rebase pulled MESITA-672, the live 5-param filter sheet — the keystone reference). Rebase touched **zero** files under `apps/mobile-consumer`. Baseline typecheck green.

---

## 1. Constraints (hard)
1. **Front-end only.** Client calls EXISTING EFs (`src/lib/ef.ts`) or the same local/mock data web uses. No `supabase/`. No new native modules this session (GPS deferred — §3).
2. **Mirror web's SHOWN UI 1:1.** Web `globals.css` tokens are mirrored into mobile `tailwind.config.js` + `constants/brand.ts`. Port web's existing design; invent nothing.
3. **No payment/subscribe UI** (Apple). Premium = status only; Subscribe stays `Linking.openURL(web)`.
4. **Match web's parked-vs-live posture.** Social + Reservations stay parked; keep the parked stub matching web's park screen. Do not un-park what web parks.
5. **Exclude Memo un-park** — `agent/memo-enable-consumer` (MESITA-671) owns it; do not touch `home.tsx` Memo wiring or `components/memo/*`.
6. **Verify via web export only** (`pnpm typecheck · lint · npx expo export --platform web`). `.native.tsx`/`Platform.OS` branches are UNVERIFIED here → tagged for Pato's EAS device pass. lucide for generic glyphs; `react-native-svg` brand marks for channel/partner logos; no `react-native-paper`.

## 2. Decisions (Pato, this session)
- **Parked surfaces (Social / Coupon / Reservation):** match web's shown park UI; **defer internal fidelity** to un-park. → P7/P8/P9 dropped from this pass.
- **GPS "Near me":** **defer** `expo-location`. Port zone-search distance (front-end-pure) which already gives on-device area filtering; GPS chip is a flagged follow-up (needs app.config.ts native config + device verify).

## 3. Success criterion
The **live consumer journey works end-to-end and matches web's shown UI**: sign-in → Swipe/Search discovery **with working Discovery Filters** → Place detail → Rewards/Pay discount redemption → Me. Not "77 gaps closed" — live-journey fidelity is the bar.

---

## 4. Architecture
Expo Router is file-based → new screens = new files. **One file, one owner.** Shared/foundation-owned (no feature package edits these): `(tabs)/_layout.tsx`, `providers/auth.tsx`, `app/index.tsx`, `app/(tabs)/me.tsx`, `ConsumerTabBar.tsx`, `app/_layout.tsx`, `tailwind.config.js`, `constants/brand.ts`, `lib/ef.ts`, plus the **frozen shared contracts** `lib/use-home-deck.ts` (return type) and `lib/saved-places.ts` (hook signature). `lib/place-overview.ts` is a **pure render-site mapper** (never called inside use-home-deck). One shared worktree; agents write disjoint files; commit per package for legible history; verify between waves.

## 5. Packages

### Foundation (Wave 0 — FA/FB/FC parallel, file-disjoint)
**FA · Auth continuity + auth-screen polish + BirthdayPicker** (HIGH)
Owns: `app/(tabs)/_layout.tsx`, `providers/auth.tsx`, `app/index.tsx`, `app/(tabs)/me.tsx`, `app/onboard.tsx`, `app/sign-in.tsx`, `app/(tabs)/rewards.tsx` (guard only), NEW `app/+not-found.tsx`, NEW `components/ui/BirthdayPicker.tsx`.
Build: sign-out routes to `/sign-in` (impl in auth.tsx); continuous auth/onboarding guard at `(tabs)` root (no session→sign-in, session&&!onboarded→onboard); branded `+not-found`; sign-in Resend-code + SMS/TOS footer + onboard identity header; `BirthdayPicker` (D/M/Y, leap-aware, YYYY-MM-DD) for P5. Web ref: shell `layout.tsx`, `components/auth/*`, `not-found.tsx`, `BirthdayPicker`.

**FB · Discovery-filter subsystem (keystone, NEW files only — no screen edits)** (HIGH)
Owns: NEW `lib/discovery-filters-engine.ts`, `lib/place-families.ts`, `lib/use-discovery-filters.ts`, `lib/zone-geocode.ts`, `components/discovery/FilterSheet.tsx` (+ Where/When/What/Randomness/zone-field parts).
Build: port the LIVE web engine near-verbatim (pure TS): `RandomnessLevel 0–5`, `DISTANCE_MIN_KM 1 / MAX 50`, `defaultRadiusForLevel`, `DiscoveryWhen` now/anytime/day+hour, `matchesDiscoveryFilters`/`applyDiscoveryFilters`/`orderByRandomness`/`deriveCategoryOptions`, `DISCOVERY_FILTER_DEFAULTS`/`hasDiscoveryPredicates`/`discoveryFiltersAreActive`. Port `zone-geocode` (Google Places Details via public `EXPO_PUBLIC_GMP_KEY` + existing `consumer-web-suggest-places` autocomplete — **front-end-pure**). NativeWind `FilterSheet` porting the REAL UI from `DiscoveryFilters.tsx`(416L) + `discovery-filter-controls.tsx`(93L) + `discovery-zone-field.tsx`: stale-pick pills, ONE tinted-circle header + Reset ghost, live-narrow-on-tap, **two-branch empty footer** (predicates set→Reset escape; host-empty→neutral note, no reset — MESITA-670), real count feedback. **Wires nothing** — Swipe/Search consume it in Wave 1. Where module: zone-search + cities/zones work on device; the GPS-"Near me" distance sub-row degrades cleanly (omit when no location) — intentional delta until the GPS follow-up.

**FC · Shared render helpers + brand marks (NEW files only)** (MED)
Owns: NEW `lib/place-overview.ts` (pure raw-column→overview mapper: stars, review count, hours+tz→open/closed, enriched_at, price), NEW `components/brand/channel-marks.tsx` (react-native-svg brand marks: whatsapp/instagram/facebook/x/threads/reddit/opentable/ubereats/uber/googlemaps/google/website — consumed by P6, P4). Web ref: `lib/adapters/*`, `place-detail-links.ts`.

### FB verify checkpoint (between Wave 0 and Wave 1)
Foundation committed + `typecheck·lint·expo export` green + FB logic sanity (engine returns sane sets, FilterSheet renders) BEFORE P1/P2 start.

### Wave 1 (P1/P2/P3 parallel — filter consumers after FB verify)
- **P1 · Swipe depth** — owns `components/swipe/*`, consumes FB+FC. Wire `FilterSheet` into filter button (replace FiltersComingSoon), filters-active dot, two-branch filter-empty state, Randomness reorder (0–5), multi-photo in-card carousel, "Saved {name}" toast + View, overview enrichment at card render. Must NOT change `use-home-deck.ts` return type.
- **P2 · Search depth** — owns `components/search/*`, consumes FB+FC. Wire `FilterSheet` (replace FiltersComingSoon), map pan/zoom to selected pin + recenter, pin↔rail sync, on-Mesita pick keeps map, "N/M places" pager, verified badge + "category·zone" subtitle, overview enrichment. `.native.tsx` map work → Pato EAS pass.
- **P3 · Favorites** — owns `components/home/FavoritesTab.tsx`, `FavoriteRow.tsx`, `lib/saved-places.ts`. Open/closed status line (via FC), overview enrichment. **Mirror web's LOCAL saved-places store + mock — NO EF.** May change saved-places internals only, not its hook signature.

### Wave 2 (P4/P6 core-journey, then P5)
- **P4 · Rewards + Pay** (core-journey tier) — owns `components/rewards/*`. NEW `TicketStoryFrame` (9:16 IG story, brand marks from FC), tappable ticket place-name→detail, ticket-detail skeleton.
- **P6 · Place detail** — owns `app/place/[id].tsx`, `components/place/*`. Sticky tab strip, real brand-mark channel icons (FC), reviews/products/profile tab fidelity.
- **P5 · Me / Profile** — owns `components/me/*` (NEVER `me.tsx`). Avatar affordance (tappable tile, Camera badge, "photo soon" toast), consume `BirthdayPicker` (FA), de-dupe sheet titles (ShareModal/VerifySocialSheet double-title), ClassModal crown header, gift-card credit-card aspect + gloss, personal-details fidelity.

### Verify + ship
Per-wave commit + `typecheck·lint·expo export`; final full verify + fix pass; verify mobile inbox reward-amount token (`--secondary`) + parked-stub parity with web's park screens (quick, if real). One branch, per-package commits; squash-PR `Closes` the umbrella issue (created at merge, solo ASDM). Tag native-only work for Pato's EAS device verification.

## 6. Out of scope
Backend-blocked gaps (2, `frontEndOnly:false`); subscribe/Stripe in-app UI (Apple, web-link); Memo un-park (MESITA-671); parked-surface internals (P7/P8/P9, deferred); GPS `expo-location` (deferred follow-up); all 48 low-severity polish items not on the live journey.

## 7. Risks & mitigations
Parallel-writer corruption → single-owner allowlists + shared files only in Foundation + waves ≤5 after FB verify. Shared-contract drift → `use-home-deck`/`saved-places` signatures frozen. Un-parking by accident → explicit park-matching; Memo excluded. Token drift → tokens Foundation-owned. Native-blind verify → `.native.tsx` tagged for Pato EAS.

---

## GSTACK REVIEW REPORT
**Runs:** /plan-design-review + /plan-ceo-review + /plan-eng-review (3 parallel lenses + completeness critic; codex unavailable, single-model cross-review).
**Status:** design 7/10 · product 7/10 · eng 7/10 → plan revised to v2; all blocker/high findings absorbed.

**Findings absorbed:**
- **[BLOCKER] Stale base** (critic) — rebased `agent/mobile-fe-parity` onto `eef07147`; FB re-specced against the live 5-param filter sheet. RESOLVED.
- **[HIGH] FB under-cited** (design) — FB now cites `DiscoveryFilters.tsx`/`discovery-filter-controls.tsx`/`discovery-zone-field.tsx` + real states + live constants (0–5 randomness, 1–50km). RESOLVED.
- **[HIGH] Geolocation guts Where module on device** (design/CEO) — resolved via zone-search (front-end-pure, on-device) + clean degradation of the GPS sub-row; GPS follow-up deferred by Pato. RESOLVED.
- **[HIGH] Shared-contract drift** (eng) — `use-home-deck`/`saved-places` frozen as Foundation contracts; `place-overview` is a pure render-site mapper. RESOLVED.
- **[MED] P3 data source ambiguity** (eng) — fixed: local store + mock, NO EF. RESOLVED.
- **[MED] me.tsx split ownership** (eng/design) — me.tsx wholly FA-owned; sign-out in auth.tsx; P5 barred. RESOLVED.
- **[MED] icon-rule vs brand marks** (design) — §1.6 amended; brand marks = Foundation shared asset (FC). RESOLVED.
- **[MED] ASDM ≤5 concurrency** (eng) — waved: Foundation → FB verify → Wave 1 (P1/P2/P3) → Wave 2 (P4/P6/P5). RESOLVED.
- **[MED] native-blind verify gate** (eng) — `.native.tsx`/`Platform.OS` explicitly tagged for Pato EAS. RESOLVED.
- **[MED] P4 under-prioritised** (CEO) — promoted to core-journey tier. RESOLVED.
- **[MED] parked-surface spend** (design/CEO) — Pato: match park UI, defer internals; P7/P8/P9 dropped. RESOLVED.
- **[MED] inbox token-drift finding mis-grounded** (critic) — downgraded to a verify-then-fix-if-real check in the final pass. NOTED.

**VERDICT:** APPROVED to execute (front-end only, waved, verified per wave). Cross-model absorbed (single-model; codex unavailable).

**UNRESOLVED DECISIONS:** NO UNRESOLVED DECISIONS
