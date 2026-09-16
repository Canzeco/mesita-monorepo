// DISCOVERY SIGNALS — the scoring micro-functions (Docs › Discovery §A).
//
// A signal is a PURE FUNCTION: one or more indexes (facts already on the row,
// or precomputed) plus the caller's intent in, ONE number in [0, 1] out. Never
// metres, never a review count, never a peso figure — normalizing is the
// signal's own job, and so is SHAPING. Proximity computes raw kilometres and
// bends them through a logarithmic curve before returning; the linear number
// never leaves the function. That is the whole contract, and it is what lets
// every engine reach the same library instead of each one inventing a scale.
//
// THERE ARE NINE: Name · Summary · Proximity · Timing · Category ·
// Enriched · Partnered · Popularity · Randomness. Slotting still runs AFTER
// the blend (discovery-blend.ts) and still buys a POSITION, not an exponent.
//
// MESITA LEVEL SPLIT INTO TWO BINARIES (MESITA-1858): `enriched` — did
// Mesita do the work on this place — and `partnered` — does this place pay.
// This is NOT a reversal of the MESITA-1408 merge. That merge killed
// Partnership × Promotion, two exponents over THE SAME money fact, which let
// an operator double-count money by accident. These two read disjoint facts:
// one the enrichment state, the other `plan`. No double-count is possible.
//
// PROMOTION LEFT THE EXPONENT ENTIRELY. `promoting` is no longer read by any
// signal. Since MESITA-1855 lane 2 is wired, so promotion buys a POSITION —
// which is what discovery-blend.ts's header always said money must do.
//
// THE ENRICHMENT GRADIENT SURVIVES THE SPLIT. MESITA-1858 first wrote
// `enriched` as a pure binary and deferred the `intake_high_water` gradient
// (MESITA-1598) to a later issue. Review caught that the binary reads the
// SAME predicate the ranked lanes admit on, so it is a constant 1 wherever it
// is scored — a dead axis and a live regression against the old ladder. The
// gradient is therefore kept, off `intakeHighWater` and
// `attachIntakeHighWater` at their three call sites. Details at `enriched`.
//
// The keys are `enriched` and `partnered`, never bare `level`, `partner` or
// `partnership`. `places.price_level` is Google's field and
// create-door-profile.ts already writes "Price level:" into a signal-shaped
// line; a bare Level would collide exactly there. `partner` is the consumer
// wire boolean (place-family-keys.ts) and `partnership` was a retired signal
// key — the past participle keeps the signal distinct from both.
//
// Semantic died. It split into Name (`places.name_embedding`) and Summary
// (`places.embedding` — the Summary blurb, never Presentation). Social left
// the library — it permanently abstained because Social Lineup never wrote
// a place-level index. Social Lineup is still Soon, and Social itself left
// the mode list (discovery-matrix.ts) — its retrieval survives only as two
// sources there, and `module` is retired along with it. Neither is a signal.
//
// NEUTRAL IS 1, NOT 0.5. Signals compose as `s^w` (see discovery-blend.ts), so
// the identity element of the blend is 1 — a signal with s=1 drops out of the
// product entirely, for any exponent. When there is no intent to read (the
// guest sent no geo, the query has no vector) the signal returns 1 and
// abstains. Returning 0.5 would look neutral and is not: it would multiply
// every place by the same factor for a fact about the CALLER, quietly
// compressing the whole deck toward zero and making an absent guest location
// change how much the OTHER signals matter. Absence of intent is not evidence
// about a place.
//
// MISSING DATA ON THE PLACE IS A DIFFERENT QUESTION and gets a different
// answer. A place with no hours, no rating or no vector has failed to tell us
// something, and the honest score there is a middling one, not an abstention —
// otherwise a bare row would outrank a fully enriched one by having nothing to
// judge. Each signal names its own unknown value below and says why.
//
// EVERY SIGNAL CLAMPS ITS OWN OUTPUT. The blend raises these to a power and
// multiplies them; one signal returning 1.2 or -0.1 would poison the product
// (a negative base under a fractional exponent is NaN). `clamp01` is applied
// on the way out of every one of them, without exception.

import { haversineKm } from "./geo.ts";
import { isOpenAt } from "./local-time-open.ts";
import { localClock } from "./local-time.ts";
import { cosineSim, parseVector } from "./embeddings-vector.ts";
import { isPaidPlan } from "./membership-enforcement-helpers.ts";
import { PULSE_TOTAL } from "./pulse-pieces.ts";

/**
 * The nine earned signals, in Notion Docs > Discovery section 8.3 order:
 * what the caller ASKED FOR first (name, summary, category), then what the
 * world is (proximity, timing), then where the place sits with us
 * (enriched, partnered, popularity), then the tie-breaker.
 *
 * ORDER IS PRESENTATION ONLY. The blend is a product of `s^w`, so it is
 * commutative; nothing downstream may read a signal by index.
 */
export const SIGNAL_KEYS = [
  "name",
  "summary",
  "category",
  "proximity",
  "timing",
  "enriched",
  "partnered",
  "popularity",
  "randomness",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

/** The neutral element of the blend: `1^w === 1` for every exponent. */
export const NEUTRAL = 1;

/** Every signal's last statement before it returns. See the header. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return NEUTRAL;
  return Math.min(1, Math.max(0, n));
}

/**
 * Shape numbers a signal may read besides its exponent. The exponent lives
 * on `weights` (the blend's `w` in `s^w`). The console edits maxKm and
 * closedFloor; the rest stay file-level defaults. A missing key falls back
 * so an old blob keeps scoring the same way.
 */
export type SignalParamBag = Record<string, number>;

function pnum(params: SignalParamBag | undefined, key: string, fallback: number): number {
  const v = params?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// ── The indexes a signal may read ────────────────────────────────────────────

/**
 * The facts a signal is allowed to see. This is a projection of `places`, not
 * the row — narrowing it here is what stops a signal from quietly reaching for
 * rates. Partnered may read `plan`; nothing else may. Still absent:
 * strategy, pause columns, and rates.
 */
export type SignalPlace = {
  lat: number | null;
  lng: number | null;
  hours: unknown;
  category: string | null;
  family_keys?: string[] | null;
  rating: number | null;
  user_ratings_total: number | null;
  /** Summary vector (`places.embedding`). Never Presentation. */
  embedding: unknown;
  /** Name vector (`places.name_embedding`). */
  nameEmbedding?: unknown;
  /**
   * Did Mesita do the work on this place. EXPLICIT: the projection
   * (`toSignalPlace`, discovery-place.ts) sets this from `isEnrichedPlace`
   * and the signal never re-derives it — a signal that reached for
   * `content_state` itself would read `undefined` on any relation that does
   * not carry the column and score the whole deck identically, silently.
   * Absent means the caller did not wire it, which scores OFF, not full
   * credit: an unstated enrichment is not an enriched place.
   */
  enriched?: boolean;
  /** Membership plan. Partnered may read `plan`; nothing else may. */
  plan?: string | null;
  /**
   * Live discount right now. NO SIGNAL READS THIS ANY MORE (MESITA-1858):
   * promotion buys a lane-2 POSITION (MESITA-1855), not an exponent. Kept on
   * the projection because the debug payload and the slotting pass both
   * still travel with it.
   */
  promoting?: boolean;
  /**
   * How far the Intake queue got, 0..PULSE_TOTAL (`pulseOf`,
   * pulse-pieces.ts). `enriched` reads this; nothing else may. It is the
   * gradient MESITA-1598 added and MESITA-1858 restored — the binary alone is
   * a constant on every lane that admits only enriched rows (see `enriched`).
   * A surface has to opt in by running `attachIntakeHighWater`; absent, the
   * signal falls back to the binary.
   */
  intakeHighWater?: number | null;
};

/** What the CALLER wants. Every field is optional; an absent one abstains. */
export type SignalIntent = {
  /** Guest position. Both halves required — a lone latitude is not a location. */
  lat?: number | null;
  lng?: number | null;
  /** Category keys the guest asked for, e.g. ["taqueria"]. */
  categories?: string[] | null;
  /** Family keys the guest asked for, e.g. ["food"]. */
  families?: string[] | null;
  /** Summary / intent query vector. Summary reads this; Name does not. */
  queryVector?: number[] | null;
  /** Name query vector. Name reads this; Summary does not. */
  queryNameVector?: number[] | null;
  /** Injectable clock, so every signal is testable without the wall clock. */
  now?: Date;
  /** Injectable RNG, same reason. Must return [0, 1). */
  random?: () => number;
};

// ── 1. Proximity ─────────────────────────────────────────────────────────────

/** Distance at which the curve reaches 0. Past this, everything ties at 0. */
export const PROXIMITY_MAX_KM = 25;
/**
 * The curve's knee. Smaller = the first kilometre costs more.
 *
 * At 1 km the FIRST kilometre costs ~0.21 of the score, while a kilometre out
 * at range costs ~0.018 — twelve times less. That marginal difference is the
 * whole point: "rewards very close hard, penalizes far gently" is the shape
 * Docs §A asks for, and it is why this is logarithmic instead of linear. (Read
 * per kilometre, not per stretch: 10→25 km is fifteen kilometres and of course
 * costs more in total than one does.)
 */
export const PROXIMITY_KNEE_KM = 1;

/**
 * Guest geo × place geo → [0, 1], through a logarithmic curve.
 *
 * No guest geo → NEUTRAL (abstain — that is a fact about the caller).
 * No place geo → 0.35. A place we cannot locate is genuinely worse for a
 * signal whose entire question is "how far", but zero would delete it from a
 * multiplicative blend, and an unlocated place is unlocated, not disqualified.
 */
export function proximity(
  place: SignalPlace,
  intent: SignalIntent,
  params?: SignalParamBag,
): number {
  const gLat = intent.lat;
  const gLng = intent.lng;
  const maxKm = Math.max(0.1, pnum(params, "maxKm", PROXIMITY_MAX_KM));
  const kneeKm = Math.max(0.01, pnum(params, "kneeKm", PROXIMITY_KNEE_KM));
  const missingGeo = clamp01(pnum(params, "missingGeo", 0.35));
  if (typeof gLat !== "number" || typeof gLng !== "number") return NEUTRAL;
  if (typeof place.lat !== "number" || typeof place.lng !== "number") return missingGeo;

  const km = haversineKm(gLat, gLng, place.lat, place.lng);
  if (!Number.isFinite(km)) return missingGeo;
  if (km >= maxKm) return 0;

  const scale = Math.log1p(maxKm / kneeKm);
  return clamp01(1 - Math.log1p(km / kneeKm) / scale);
}

// ── 2. Timing ────────────────────────────────────────────────────────────────

/**
 * Open, AND is this its hour. Two different questions that share one number.
 *
 * `open` dominates because it is the one a guest feels immediately — a closed
 * door ends the visit — but a closed place scores 0.2 rather than 0, because
 * the house rule is DEMOTE, DON'T HIDE (the same rule `demoteClosed` encodes
 * for Memo). Zero in a multiplicative blend is not a demotion, it is deletion,
 * and a place that opens in twenty minutes should still be reachable.
 *
 * No usable hours → the open half abstains at NEUTRAL rather than guessing
 * closed. `isOpenAt` already distinguishes "no data" (null) from "nothing is
 * open right now" (false), so we do not have to.
 */
export const TIMING_OPEN_SHARE = 0.7;
export const TIMING_CLOSED_FLOOR = 0.2;

/**
 * Is this the place's hour? Read off the place's own local clock, not the
 * server's — a multi-city pool is judged in each place's own time.
 *
 * This is deliberately COARSE. Hour bands and their scores stay in code
 * (the function's shape). The console only edits closedFloor.
 */
export const DAYPART_DEAD = 0.25;
export const DAYPART_DAWN = 0.55;
export const DAYPART_BREAKFAST = 0.8;
export const DAYPART_MIDDAY = 1;
export const DAYPART_EVENING = 1;
export const DAYPART_LATE = 0.5;

export function daypartScore(hour: number, params?: SignalParamBag): number {
  if (hour >= 2 && hour < 6) return clamp01(pnum(params, "dead", DAYPART_DEAD));
  if (hour >= 6 && hour < 8) return clamp01(pnum(params, "dawn", DAYPART_DAWN));
  if (hour >= 8 && hour < 11) return clamp01(pnum(params, "breakfast", DAYPART_BREAKFAST));
  if (hour >= 11 && hour < 17) return clamp01(pnum(params, "midday", DAYPART_MIDDAY));
  if (hour >= 17 && hour < 23) return clamp01(pnum(params, "evening", DAYPART_EVENING));
  return clamp01(pnum(params, "late", DAYPART_LATE));
}

export function timing(
  place: SignalPlace,
  intent: SignalIntent,
  params?: SignalParamBag,
): number {
  const now = intent.now ?? new Date();
  const clock = localClock(place.lng ?? null, now);
  // No resolvable local clock — we cannot ask either half of the question.
  if (!clock) return NEUTRAL;

  const openShare = clamp01(pnum(params, "openShare", TIMING_OPEN_SHARE));
  const closedFloor = clamp01(pnum(params, "closedFloor", TIMING_CLOSED_FLOOR));
  const open = isOpenAt(place.hours, clock.weekday, clock.minutes);
  const openPart = open === null ? NEUTRAL : open ? 1 : closedFloor;
  const dayPart = daypartScore(clock.hour, params);

  return clamp01(openPart * openShare + dayPart * (1 - openShare));
}

// ── 3. Category ──────────────────────────────────────────────────────────────

/** Exact category hit. */
export const CATEGORY_EXACT = 1;
/** Right family, wrong category — a taqueria when the guest asked for sushi. */
export const CATEGORY_FAMILY = 0.55;
/** Wrong family. Low, never zero: see the header on deletion vs demotion. */
export const CATEGORY_MISS = 0.1;

/**
 * Does the type answer the intent?
 *
 * No category intent → NEUTRAL. The guest did not ask, so this signal has
 * nothing to judge and abstains — this is the common case on Swipe, where the
 * whole point is that nobody has narrowed anything.
 *
 * A place with no category at all scores CATEGORY_FAMILY when an intent
 * exists: it might match, we cannot tell, and an uncategorised place is an
 * enrichment gap rather than a wrong answer.
 */
export function category(
  place: SignalPlace,
  intent: SignalIntent,
  params?: SignalParamBag,
): number {
  const wantCats = (intent.categories ?? []).filter(Boolean);
  const wantFams = (intent.families ?? []).filter(Boolean);
  if (wantCats.length === 0 && wantFams.length === 0) return NEUTRAL;

  const exact = clamp01(pnum(params, "exact", CATEGORY_EXACT));
  const family = clamp01(pnum(params, "family", CATEGORY_FAMILY));
  const miss = clamp01(pnum(params, "miss", CATEGORY_MISS));

  const cat = place.category;
  const fams = place.family_keys ?? [];
  if (!cat && fams.length === 0) return family;

  if (cat && wantCats.includes(cat)) return exact;
  if (wantFams.some((f) => fams.includes(f))) return family;
  // The guest named categories; resolve those to families via the place's own
  // family keys only — this signal never loads the taxonomy, it reads the row.
  if (wantCats.length > 0 && fams.length > 0 && wantFams.length === 0) {
    return miss;
  }
  return miss;
}

// ── 4. Popularity ────────────────────────────────────────────────────────────

/**
 * Bayesian shrinkage toward the catalog mean, so a 5.0 from three reviews does
 * not outrank a 4.6 from nine hundred. `m` is the confidence weight: the
 * review count at which a place's own rating carries half the answer.
 */
export const POPULARITY_PRIOR_RATING = 4.2;
export const POPULARITY_CONFIDENCE = 60;

/**
 * Rating × volume → [0, 1].
 *
 * No rating data → the prior, which is exactly what shrinkage means when the
 * evidence is empty: the catalog's average place. Not NEUTRAL — an unrated
 * place is a real place we know nothing flattering about, and abstaining would
 * hand it a free 1.
 *
 * The scale is anchored at 3.0, not 0. Nothing in a curated catalog sits at a
 * true 1.0, so mapping [0,5] linearly would squash every real place into the
 * top third of the range and waste most of the signal's resolution.
 */
export const POPULARITY_FLOOR_RATING = 3;

export function popularity(
  place: SignalPlace,
  _intent?: SignalIntent,
  params?: SignalParamBag,
): number {
  const prior = pnum(params, "priorRating", POPULARITY_PRIOR_RATING);
  const confidence = Math.max(1, pnum(params, "confidence", POPULARITY_CONFIDENCE));
  const floor = pnum(params, "floorRating", POPULARITY_FLOOR_RATING);
  const r = typeof place.rating === "number" ? place.rating : null;
  const v = typeof place.user_ratings_total === "number"
    ? Math.max(0, place.user_ratings_total)
    : 0;

  const shrunk = r === null
    ? prior
    : (v * r + confidence * prior) / (v + confidence);

  const span = 5 - floor;
  if (!(span > 0)) return clamp01(shrunk >= 5 ? 1 : 0);
  return clamp01((shrunk - floor) / span);
}

// ── 5. Name ──────────────────────────────────────────────────────────────────

/**
 * Guest name query vs `places.name_embedding`. Deep Search already ranks
 * Mesita lanes by this cosine; the Lineup exposes the same index as a
 * weightable signal. It does not share Summary's query vector.
 *
 * Cosine lands in [-1, 1] and is remapped to [0, 1].
 *
 * No name query vector → NEUTRAL.
 * No place name vector → 0.4 (enrichment gap, not deletion).
 */
export const NAME_UNEMBEDDED = 0.4;

function vectorScore(
  placeVec: unknown,
  query: number[] | null | undefined,
  unembedded: number,
): number {
  if (!Array.isArray(query) || query.length === 0) return NEUTRAL;
  const v = parseVector(placeVec);
  if (!v || v.length !== query.length) return unembedded;
  const cos = cosineSim(query, v);
  if (!Number.isFinite(cos)) return unembedded;
  return clamp01((cos + 1) / 2);
}

export function name(
  place: SignalPlace,
  intent: SignalIntent,
  params?: SignalParamBag,
): number {
  const unembedded = clamp01(pnum(params, "unembedded", NAME_UNEMBEDDED));
  return vectorScore(place.nameEmbedding, intent.queryNameVector, unembedded);
}

// ── 6. Summary ───────────────────────────────────────────────────────────────

/**
 * Intent vs the place's SUMMARY embedding (`places.embedding`) — never the
 * Presentation. Docs › Discovery §C: About is the narrative a guest reads,
 * Summary is the machine blurb; we embed the second one, and the enrichment
 * queue's semantic `summary` function is what writes it. That Intake stamp
 * is a different word from this signal.
 *
 * No query vector → NEUTRAL (the caller asked nothing).
 * No place vector → 0.4. The place has not been embedded yet, which is an
 * enrichment gap; it should lose to an embedded place on a Summary query
 * without being deleted from the deck.
 *
 * Old blobs stored this as `semantic`. normalize() folds that key here.
 */
export const SUMMARY_UNEMBEDDED = 0.4;
/** @deprecated Folded into Summary. Kept so old imports compile during the cut. */
export const SEMANTIC_UNEMBEDDED = SUMMARY_UNEMBEDDED;

export function summary(
  place: SignalPlace,
  intent: SignalIntent,
  params?: SignalParamBag,
): number {
  const unembedded = clamp01(pnum(params, "unembedded", SUMMARY_UNEMBEDDED));
  return vectorScore(place.embedding, intent.queryVector, unembedded);
}

// ── 7. Enriched ──────────────────────────────────────────────────────────────

/**
 * Did Mesita do the work on this place.
 *
 * ONE FACT, READ AND NOTHING ELSE: the explicit `enriched` boolean the
 * projection set from `isEnrichedPlace` (place-family-keys.ts — `content_state
 * = 'ready'` OR a stamped `enriched_at`). The signal does not re-derive it,
 * and there is deliberately no second predicate here: two answers to "is this
 * place enriched" is how the consumer wire and the ranker drift apart.
 *
 * GRADED WHERE THE ROW CARRIES A HIGH-WATER NUMBER, binary where it does not.
 *
 * MESITA-1858 wrote this as a pure binary and called the lost resolution a
 * deferred item. IT IS NOT DEFERRABLE, because the binary reads the SAME
 * PREDICATE THE RANKED LANES ADMIT ON, so on every surface that can score it
 * the answer is a constant 1:
 *
 *   - Map filters every listed row through `keepListedForScope` →
 *     `isEnrichedListedRow`, a copy of `isEnrichedPlace`, BEFORE
 *     `reorderListedLanes` ranks anything.
 *   - Scroll's pool query is `.eq("content_state", "ready")`.
 *   - Word masks this signal to 0 and never scores it at all.
 *
 * A constant signal cannot reorder a deck, and the Discovery console would be
 * rendering an operator a dial that does nothing. Worse, it is a REGRESSION:
 * the retired `mesita_level` folded `intake_high_water` (0..PULSE_TOTAL), a
 * fact that is NOT the admission predicate, so it did discriminate among
 * admitted rows — two ready partner rows at one point on the Map, high-water
 * 10 and 2, ranked 3.1x apart and would now tie, handing the order to
 * whatever Postgres returned.
 *
 * So the gradient is restored here, verbatim: `ENRICHED_OFF + (1 -
 * ENRICHED_OFF) * hw / PULSE_TOTAL`, which is MESITA-1598's own
 * `0.15 + 0.85 * hw/10`. MESITA-1858 kept `intakeHighWater` and
 * `attachIntakeHighWater` wired for exactly this, and the issue's note that
 * the collapse was deliberate was written believing the binary would still
 * separate enriched from unenriched places in a deck — which it cannot,
 * because an unenriched place never enters one. Pato reverses this in one
 * line by deleting the high-water branch.
 *
 * AN EXPLICIT `enriched: false` STAYS AT THE FLOOR whatever the side-read
 * says. That is the googleOnly exclusion the projection makes by name; a
 * synthesized row must not be able to climb on a number fetched by id.
 *
 * ABSENT READS OFF, NOT UNKNOWN. The opposite of `intakeHighWater`'s old
 * rule, and deliberately: high-water is a side-read a surface has to opt
 * into, while `enriched` is set by the projection every ranking engine runs
 * through. An absent value means the row genuinely said nothing, and the
 * honest score for "we have no evidence Mesita touched this" is the floor.
 */

/**
 * The off value. NEVER 0 — a hard zero deletes a place from a multiplicative
 * blend (discovery-blend.ts). Demote, don't hide.
 *
 * 0.15 is `LEVEL_ENRICHMENT_FLOOR` carried over verbatim from MESITA-1598, so
 * the split is an order-preserving refactor rather than a re-tuning.
 */
export const ENRICHED_OFF = 0.15;

export function enriched(
  place: SignalPlace,
  _intent?: SignalIntent,
  _params?: SignalParamBag,
): number {
  if (place.enriched === false) return clamp01(ENRICHED_OFF);
  const highWater = place.intakeHighWater;
  if (typeof highWater === "number" && Number.isFinite(highWater)) {
    return clamp01(
      ENRICHED_OFF + (1 - ENRICHED_OFF) * clamp01(highWater / PULSE_TOTAL),
    );
  }
  return clamp01(place.enriched === true ? 1 : ENRICHED_OFF);
}

// ── 8. Partnered ─────────────────────────────────────────────────────────────

/**
 * Does this place pay Mesita.
 *
 * ONE FACT, READ AND NOTHING ELSE: `plan`, through `isPaidPlan`
 * (membership-enforcement-helpers.ts) — the same predicate the consumer wire's
 * `partner` boolean uses, never a second copy. Never rates, never strategy,
 * never the pause columns, and no longer `promoting`: a live discount buys a
 * lane-2 position (MESITA-1855), not an exponent.
 *
 * THE EMPTY STRING IS NORMALIZED BEFORE THE CALL, and that is load-bearing.
 * `isPaidPlan` is `(plan ?? "free").toLowerCase() !== "free"`, so it answers
 * TRUE for `""` — the coalesce only catches null and undefined. `places.plan`
 * is a NOT NULL enum defaulting to `'free'`, so an empty string can only reach
 * here from a synthesized Google row or a fixture, which is exactly where a
 * free place silently scoring as a partner would go unnoticed.
 */

/**
 * The off value. NEVER 0 — see ENRICHED_OFF.
 *
 * 0.2 is `LEVEL_LISTED / LEVEL_PARTNER`, the 5x partner-over-listed spacing
 * the old ladder had, carried over so the order no guest sees change.
 */
export const PARTNERED_OFF = 0.2;

export function partnered(
  place: SignalPlace,
  _intent?: SignalIntent,
  _params?: SignalParamBag,
): number {
  const plan = (place.plan ?? "").trim();
  if (plan === "") return clamp01(PARTNERED_OFF);
  return clamp01(isPaidPlan(plan) ? 1 : PARTNERED_OFF);
}

// ── 9. Randomness ────────────────────────────────────────────────────────────

/**
 * The only signal that reads nothing about the place.
 *
 * It exists so the deck is not deterministic: with every other signal fixed, a
 * catalog would serve the same order to the same guest forever. Under `s^w` an
 * exponent BELOW 1 softens it (r^0.3 pushes a uniform draw toward 1, so it
 * only breaks near-ties) and an exponent of 0 removes it outright. That is why
 * its default exponent is the only one below 1.
 */
export function randomness(_place: SignalPlace, intent?: SignalIntent): number {
  const rng = intent?.random ?? Math.random;
  return clamp01(rng());
}

// ── The library ──────────────────────────────────────────────────────────────

export type SignalFn = (
  place: SignalPlace,
  intent: SignalIntent,
  params?: SignalParamBag,
) => number;

/**
 * The library every engine reaches. Engines call signals; signals never call
 * engines, and no engine owns one — that shared reach is the reason admin
 * Discovery is one table instead of one per surface.
 */
export const SIGNALS: Record<SignalKey, SignalFn> = {
  name,
  summary,
  proximity,
  timing,
  category,
  popularity,
  enriched,
  partnered,
  randomness,
};

/** Operator-facing names. The admin weights table renders these. */
export const SIGNAL_LABELS: Record<SignalKey, string> = {
  name: "Name",
  summary: "Summary",
  proximity: "Proximity",
  timing: "Timing",
  category: "Category",
  popularity: "Popularity",
  enriched: "Enriched",
  partnered: "Partnered",
  randomness: "Randomness",
};

/** One line each, for the same table. What the signal asks, not how it works. */
export const SIGNAL_BLURBS: Record<SignalKey, string> = {
  name: "The query name against the place's name vector.",
  summary: "The query against the place's Summary vector — never Presentation.",
  proximity: "How far is it, bent through a log curve — close counts hard, far counts gently.",
  timing: "Is it open, and is this its hour — read in the place's own local time.",
  category: "Does the type answer what the guest asked for.",
  popularity: "Rating shrunk toward the catalog mean by review volume.",
  enriched: "Did Mesita do the work on this place — a written profile, not a raw Google row.",
  partnered: "Does this place pay Mesita. Demotes a free place, never hides it.",
  randomness: "Reads nothing about the place. Keeps the deck from freezing.",
};
