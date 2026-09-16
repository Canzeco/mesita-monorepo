// Discovery mode × entity × pool × source × signal matrix.
//
// SPEC MIRROR, NOT A DISPATCHER. Twin of admin
// `apps/web-admin/.../filters-config/catalog.ts` DISCOVERY_MODE_*. Change one,
// change the other. Vercel root is apps/web-admin so that bundle cannot import
// this file. Do not dispatch from modeCallsSource.
//
// TWO NOUNS, AND ONLY TWO: a **Mode** is a guest Discovery surface, a
// **Source** is a retrieval mechanism a mode calls. `module` is retired —
// these things do not modularize anything, they fetch. Spanish decided it:
// *modo / módulo* differ by two letters, *modo / fuente* cannot be confused.
//
// SIX MODES (Notion Docs > Discovery section 8.1). Word is the searchbar —
// fast, deep, and the one mode that can answer with a Location. Map is the
// pins. They share a screen and are still two modes, because they answer with
// different sets from different sources. Social left the mode list; its
// retrieval survives as the two Socials sources below.
//
// NINE SOURCES (section 8.2). `Search` survives only where it quotes an
// endpoint Google itself named that way, plus the Mesita four that mirror
// them. Perplexity is not a Source: Chat has no external retrieval behind it.
// Eight of the nine have a caller; Mesita Places Browse Search has none and
// says so in ink, one row of empty marks — see DISCOVERY_SOURCES_NO_CALLER.

import {
  SIGNAL_KEYS,
  type SignalKey,
} from "./discovery-signals.ts";

export const DISCOVERY_MODE_KEYS = [
  "word",
  "map",
  "catalog",
  "swipe",
  "chat",
  "favorites",
] as const;

export type DiscoveryModeKey = (typeof DISCOVERY_MODE_KEYS)[number];

/**
 * What a mode can put IN FRONT OF THE GUEST. A Place is a place; a Location
 * is a region or a city — name, type, and the coordinates the next step
 * needs (Pato, 2026-09-02). A Social is an event a place hosts, which is a
 * different answer from the place itself and never merges into one list
 * with it (MESITA-1856). Socials is SPEC-ONLY today: both Socials sources
 * are Soon and there is no events engine behind either.
 */
export const DISCOVERY_ENTITIES = [
  { key: "location", label: "Locations" },
  { key: "place", label: "Places" },
  { key: "social", label: "Socials" },
] as const;

export type DiscoveryEntityKey = (typeof DISCOVERY_ENTITIES)[number]["key"];

/**
 * Autocomplete is the ONE source that answers with Locations, and it returns
 * them in the SAME call as the Places — not a second request. So the mode
 * that can hand back a Location is exactly the mode that calls Autocomplete:
 * Word. Text Search returns Places even when the query reads like a city, so
 * Word's Location rows only ever come from its Autocomplete query.
 *
 * Socials follows the same rule one band down: the modes that can answer
 * with an event are exactly the modes that call a Socials source — Catalog
 * rails them, Chat is asked about them.
 */
export const DISCOVERY_MODE_ENTITIES: Record<
  DiscoveryModeKey,
  readonly DiscoveryEntityKey[]
> = {
  word: ["location", "place"],
  map: ["place"],
  catalog: ["place", "social"],
  swipe: ["place"],
  chat: ["place", "social"],
  favorites: ["place"],
};

/**
 * THE THREE NESTED PLACE TYPES, in the code's own words: `nearby-places.ts`
 * opens with `Google Places ⊃ Mesita Enriched Places ⊃ Mesita Partner
 * Places`, and `PlacesScope = "partners" | "mesita" | "google"` IS this
 * band. `Mesita Listed` retired at MESITA-1856: listing is a row existing,
 * which no mode gates on — enrichment is the gate every mode actually runs.
 */
export const DISCOVERY_POOLS = [
  { key: "google", label: "Google Places" },
  { key: "enriched", label: "Mesita Enriched Places" },
  { key: "partner", label: "Mesita Partnered Places" },
] as const;

export type DiscoveryPoolKey = (typeof DISCOVERY_POOLS)[number]["key"];

/**
 * Which rings a mode demands. Relabelling alone would have left two of the
 * three rows dead for every mode, so the mapping moved with the labels
 * (MESITA-1856):
 *
 *   Map        all three — it is the one mode whose GUEST picks the ring,
 *              and `keepListedForScope` refuses an unenriched row before it
 *              even reads the scope, so Enriched is Map's floor and
 *              Partnered its narrowest ring.
 *   Catalog    Google + Enriched. `filters.requireReady` defaults true and
 *   Swipe      Scroll hardcodes it; requireReady IS the enrichment gate —
 *              discovery-filters turns it into `content_state = 'ready'`.
 *   Favorites  Google alone: a bookmark is always a Google-sourced place,
 *              and it is NOT gated on enrichment — bookmarks may include
 *              unenriched Create stubs.
 *   Word, Chat no ring gate at all; they answer from whatever came back.
 */
export const DISCOVERY_MODE_POOLS: Record<
  DiscoveryModeKey,
  readonly DiscoveryPoolKey[]
> = {
  word: [],
  map: ["google", "enriched", "partner"],
  catalog: ["google", "enriched"],
  swipe: ["google", "enriched"],
  chat: [],
  favorites: ["google"],
};

export const DISCOVERY_SOURCES = [
  "Google Places Autocomplete Search",
  "Google Places Text Search",
  "Google Places Nearby Search",
  "Mesita Places Name Search",
  "Mesita Places Nearby Search",
  "Mesita Places Browse Search",
  "Mesita Places Flexible Search",
  "Mesita Socials Browse Search",
  "Mesita Socials Flexible Search",
] as const;

/**
 * THE ONE SOURCE NO MODE CALLS, named out loud (MESITA-1856).
 *
 * Mesita Places Browse Search lost its only caller at MESITA-1697, when
 * Catalog became Flexible. It left this list then, which made the Matrix
 * report eight sources while Search Sources rendered nine boxes — the box
 * never went anywhere, and a map that under-reports the territory by one is
 * worse than a row of empty marks. So the row is back, off for every mode,
 * and the contract test asserts exactly that: a source is either called by
 * some mode, or it is listed here.
 */
export const DISCOVERY_SOURCES_NO_CALLER = [
  "Mesita Places Browse Search",
] as const;

/**
 * Locked mode → sources.
 *
 * THE FOUR MESITA PLACES SOURCES ARE TOLD APART BY WHAT DRAWS THE CANDIDATE
 * SET, never by what ranks it — Lineup ranks all four the same way, under the
 * mode's own signal mask:
 *
 *   Name      a string, matched on `places.name_embedding`   → Word
 *   Nearby    a centre and a radius, closest-N               → Map
 *   Browse    no query at all, the catalog itself            → no mode today
 *   Flexible  an arbitrary set of predicates                 → Swipe, Catalog, Chat
 *
 * CATALOG BECAME FLEXIBLE AT MESITA-1697, and this is the reclassification
 * that came with it. The rule never changed — a source is Flexible when the
 * guest hands it predicates — but Catalog's surface (Home's Feed) grew a
 * filter control, and `consumer-web-list-catalog` now cuts its pool with
 * `applyDeckPredicates` before it plans a single rail. It stopped admitting on
 * nothing, so it stopped being Browse.
 *
 * This block used to read "SWIPE IS FLEXIBLE, NOT BROWSE, and the difference
 * is the guest's own filter sheet". That contrast is retired rather than
 * wrong: both modes now carry one. Places Browse currently has no mode at
 * all, and it is kept in the table because it is what any future engine that
 * rails the catalog with no guest input would be.
 *
 * THE SOCIALS SOURCES OUTLIVED THE SOCIAL MODE. Socials answer with events a
 * place hosts, not with places, and they lost their own surface when the mode
 * list became six — so the two sources hang off the two modes that can carry
 * an event: Catalog rails it, Chat is asked about it. Both are still Soon; no
 * events engine exists.
 */
export const DISCOVERY_MODE_SOURCES = {
  word: [
    "Google Places Autocomplete Search",
    "Google Places Text Search",
    "Mesita Places Name Search",
  ],
  map: ["Google Places Nearby Search", "Mesita Places Nearby Search"],
  catalog: ["Mesita Places Flexible Search", "Mesita Socials Browse Search"],
  swipe: ["Mesita Places Flexible Search"],
  chat: [
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Mesita Places Flexible Search",
    "Mesita Socials Flexible Search",
  ],
  favorites: [],
} as const;

export const DISCOVERY_MODE_SIGNALS: Record<
  DiscoveryModeKey,
  readonly SignalKey[]
> = {
  word: ["name"],
  map: ["category", "proximity", "timing", "enriched", "partnered", "popularity"],
  catalog: [
    "category",
    "proximity",
    "timing",
    "enriched",
    "partnered",
    "popularity",
    "randomness",
  ],
  swipe: [
    "category",
    "proximity",
    "timing",
    "enriched",
    "partnered",
    "popularity",
    "randomness",
  ],
  chat: [
    "name",
    "summary",
    "category",
    "proximity",
    "timing",
    "enriched",
    "partnered",
    "popularity",
  ],
  favorites: [],
};

/**
 * ON THE MASK, PINNED TO EXPONENT 0. The signal is part of this mode's product,
 * but on THIS mode its exponent provably cannot reorder the result, so the
 * console renders a labelled em-dash, stores nothing, and `weightsForMode`
 * returns 0. Same rule as Word's missing column — a knob that changes nothing
 * is a knob that lies.
 *
 * map / randomness  Map is a pin field. A shuffled pin is a moved pin.
 *
 * map / partnered   MAP PRICES PARTNERSHIP BY SPLITTING LANES, NOT BY AN
 *                   EXPONENT. Map's only ranking path is `reorderListedLanes`
 *                   (_shared/nearby-lineup.ts): it splits the listed rows with
 *                   `isMesitaPartnerRow` into a partners lane and an extra
 *                   lane, then blends each lane INDEPENDENTLY. On those rows
 *                   the predicate reduces to `isPaidPlan(row.plan)` —
 *                   PLACE_CARD_COLUMNS carries no `partner` key and the
 *                   `profiles` view has no such column, so the `row.partner`
 *                   branches never fire — and `partnered()` returns exactly 1
 *                   for any non-free plan and 0.2 otherwise. Within a lane it
 *                   is therefore a CONSTANT factor, and `s^w` over a constant
 *                   is a constant: no value of w moves a single row. The one
 *                   escape, an empty-string plan that `isPaidPlan` calls paid
 *                   while `partnered()` floors at 0.2, is closed by the schema
 *                   — places.plan is NOT NULL DEFAULT 'free' over the enum
 *                   free|pro|ultra. The order is IDENTICAL either way, which
 *                   is why zeroing it is safe; do not "restore" it.
 */
export const DISCOVERY_MODE_SIGNAL_ZERO: Partial<
  Record<DiscoveryModeKey, readonly SignalKey[]>
> = {
  map: ["randomness", "partnered"],
};

/**
 * THE MODES THAT EARN A WEIGHT COLUMN (MESITA-1859). A mode is here when BOTH
 * halves hold, and the contract test in discovery-matrix.test.ts asserts both:
 *
 *   1. some non-test file calls `weightsForMode` for it, and
 *   2. its mask carries MORE THAN ONE signal.
 *
 * Half 1 alone is wrong, and Word is why. Word calls `weightsForMode` twice
 * (consumer-search-lane.ts), so a caller-set rule would hand it a column — but
 * its mask is `["name"]`, and a one-factor product `s^w` is a monotone
 * transform of `s`. The exponent cannot reorder a Word result, so a column for
 * it would be a knob that provably changes nothing.
 *
 *   map     ranks only on the no-Google-fill branch (`willReorder` in
 *           consumer-web-list-places/index.ts) — CONDITIONALLY real, and the
 *           console card says so.
 *   swipe   always ranks. Every Scroll deck goes through it.
 *
 * Catalog ranks by cosine, Chat and Favorites have no engine, and Favorites'
 * mask is empty besides — none of them calls this function at all.
 */
export const WEIGHTED_MODE_KEYS = ["map", "swipe"] as const;

export type WeightedModeKey = (typeof WEIGHTED_MODE_KEYS)[number];

/** A stored per-mode exponent bag. Sparse: a missing key falls back. */
export type WeightsByMode = Partial<
  Record<DiscoveryModeKey, Partial<Record<SignalKey, number>>>
>;

export function modeReturnsEntity(
  mode: DiscoveryModeKey,
  entity: DiscoveryEntityKey,
): boolean {
  return DISCOVERY_MODE_ENTITIES[mode].includes(entity);
}

export function modeRequiresPool(
  mode: DiscoveryModeKey,
  pool: DiscoveryPoolKey,
): boolean {
  return DISCOVERY_MODE_POOLS[mode].includes(pool);
}

export function modeCallsSource(mode: DiscoveryModeKey, source: string): boolean {
  return (DISCOVERY_MODE_SOURCES[mode] as readonly string[]).includes(source);
}

export function modeSignalState(
  mode: DiscoveryModeKey,
  signal: SignalKey,
): "on" | "off" | "zero" {
  if (DISCOVERY_MODE_SIGNAL_ZERO[mode]?.includes(signal)) return "zero";
  if (DISCOVERY_MODE_SIGNALS[mode].includes(signal)) return "on";
  return "off";
}

/**
 * Off and zero → exponent 0. On → this mode's own weight, else the global one.
 *
 * THE MASK IS CONSULTED FIRST, ALWAYS (MESITA-1859). `DISCOVERY_MODE_SIGNALS`
 * and `DISCOVERY_MODE_SIGNAL_ZERO` are code law, not data: change the mask and
 * every mode re-zeros on the next deploy. Folding them into the stored blob
 * would let a persisted vector carry a non-zero weight for a signal
 * `modeSignalState` reports as "off" — the Matrix renders from
 * `modeSignalState`, so the console would say off while the engine multiplied
 * `s^w`.
 *
 * Reading the mask first also makes a missing mode key harmless: it falls back
 * to `global`, never to `undefined`. That matters more than it looks. A
 * missing key does NOT produce NaN — `discovery-blend.ts` short-circuits a
 * non-finite or non-positive exponent to OFF, so EVERY signal would turn off,
 * every place would score exactly 1, and the deck would silently fall back to
 * incoming order with nothing in any log.
 */
export function weightsForMode(
  mode: DiscoveryModeKey,
  global: Record<SignalKey, number>,
  byMode?: WeightsByMode,
): Record<SignalKey, number> {
  const out = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) {
    const state = modeSignalState(mode, key);
    out[key] = state === "on" ? byMode?.[mode]?.[key] ?? global[key] ?? 0 : 0;
  }
  return out;
}
