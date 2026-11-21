// What Discovery IS (MESITA-2327): five Sources, four Pipelines, four
// Signals, two Gates, one Factor (Premier, the paid tier, MESITA-2925;
// Selected's multiplier before it), and who uses whom. The admin console
// renders this file (its twin, apps/web-admin filters-config/discovery-surface.ts, is pinned
// equal by discovery-surface.contract.test.ts) and discovery-surface.test.ts
// checks it against the call sites, so the page cannot describe an engine
// that does not exist.
//
//   Source    a callable retrieval unit with declared output fields
//   Pipeline  orchestrates sources, gates and signals (Name · Map · Catalog · Deep)
//   Signal    a continuous score in 0..1
//   Gate      a binary eligibility check (0 or 1)
//   Factor    a multiplier on the score: it orders, never excludes (none
//             from MESITA-2439 until Selected, MESITA-2717; Premier since
//             MESITA-2925)
//
// The Map and the Catalog are two pipelines since MESITA-2909 (one Area
// before); Saved is a saved collection; the Chat Agent sits above the pipelines and calls Deep, never a
// source. Which source can feed which signal or gate is DERIVED from the
// declared fields, never kept as a second map.

export const DISCOVERY_FIELDS = [
  "place_id",
  "name",
  "address",
  "coordinates",
  "rating",
  "review_count",
  "family",
  "open_now",
  "description_embedding",
  "about",
  "premier",
  "event",
] as const;
export type DiscoveryField = (typeof DISCOVERY_FIELDS)[number];

export const DISCOVERY_FIELD_LABELS: Record<DiscoveryField, string> = {
  place_id: "Place ID",
  name: "Name",
  address: "Address",
  coordinates: "Coordinates",
  rating: "Rating",
  review_count: "Review count",
  family: "Family",
  open_now: "Open now",
  description_embedding: "Description embedding",
  about: "About",
  premier: "Premier",
  event: "Events",
};

export const DISCOVERY_SOURCE_KEYS = [
  "google_autocomplete",
  "google_text",
  "mesita_places",
  "mesita_social",
] as const;
export type DiscoverySourceKey = (typeof DISCOVERY_SOURCE_KEYS)[number];

export type DiscoverySourceFact = {
  key: DiscoverySourceKey;
  label: string;
  retrieves: string;
  provides: readonly DiscoveryField[];
  /** False when no engine retrieves from it yet. */
  live: boolean;
};

const GOOGLE_LISTING: readonly DiscoveryField[] = [
  "place_id",
  "name",
  "address",
  "coordinates",
  "rating",
  "review_count",
  "family",
  "open_now",
];

export const DISCOVERY_SOURCES: readonly DiscoverySourceFact[] = [
  {
    key: "google_autocomplete",
    label: "Google Autocomplete",
    retrieves: "Google places, and Locations (cities, regions), while a name is typed.",
    provides: ["place_id", "name", "address"],
    live: true,
  },
  {
    key: "google_text",
    label: "Google Text Search",
    retrieves: "Google places matching a typed query, with the listing facts.",
    provides: GOOGLE_LISTING,
    live: true,
  },
  {
    key: "mesita_places",
    label: "Mesita Places Search",
    retrieves: "Mesita's own places, queried by area or by meaning, as each pipeline needs. Never by name: Google's name is canonical (MESITA-2896).",
    provides: [
      "place_id",
      "name",
      "address",
      "coordinates",
      "rating",
      "review_count",
      "family",
      "description_embedding",
      "about",
      "premier",
    ],
    live: true,
  },
  {
    key: "mesita_social",
    label: "Mesita Social Search",
    retrieves: "Events that places host. No engine retrieves events yet.",
    provides: ["event"],
    live: false,
  },
];

export const DISCOVERY_SIGNAL_KEYS = [
  "description_similarity",
  "proximity",
  "popularity",
] as const;
export type DiscoverySignalKey = (typeof DISCOVERY_SIGNAL_KEYS)[number];

export type DiscoverySignalFact = {
  key: DiscoverySignalKey;
  label: string;
  formula: string;
  /** Candidate fields the signal reads. */
  requires: readonly DiscoveryField[];
  /** What the request must carry. */
  query: string;
  computation: "runtime" | "precomputed" | "hybrid";
  cost: string;
  missing: string;
  /** How the raw value becomes a score in 0..1. */
  normalization: string;
};

export const DISCOVERY_SIGNALS: readonly DiscoverySignalFact[] = [
  {
    key: "description_similarity",
    label: "Description",
    formula: "cosine(request embedding, place summary embedding)",
    requires: ["description_embedding"],
    query: "The guest's request, in their words.",
    computation: "hybrid",
    cost: "Place vectors are precomputed; one embedding call, only when a pipeline that uses it runs.",
    missing: "No summary embedding: the place is left out (cannot judge), not ranked as a mismatch.",
    normalization: "A cosine clamped to 0..1 (a negative one is 0); Deep keeps what clears the operator's minimum Description score.",
  },
  {
    key: "proximity",
    label: "Proximity",
    formula: "1 ÷ (1 + (distance ÷ half distance)^exponent)",
    requires: ["coordinates"],
    query: "A point location: the device or a saved pin.",
    computation: "runtime",
    cost: "Local arithmetic, free.",
    missing: "No location: not used (n/a). No coordinates: 0.",
    normalization: "0..1 by construction: 1 at the point, ½ at the recipe row's Half distance (0.1–100 km) whatever its Distance exponent (0.5–5, MESITA-3083, MESITA-4451), never 0. Each Catalog row has its own pair (MESITA-4454: Nearby Organic 0.1 km and 4, Nearby Inorganic 0.5 km and 2, Family 2 km and 2, Popular 10 km and 2). At exponent 1 the curve is the plain reciprocal (MESITA-3015): past the Half distance the credit is Half distance ÷ distance. Under 1 the far keeps its credit; over 1 the curve is flat inside the Half distance and a cliff past it. The Catalog and Chat only: the Map rows have no Proximity, its distance only screens. It replaced the log curve (MESITA-2909), which kept a famous place 36 km away above an average one 5 km away.",
  },
  {
    key: "popularity",
    label: "Popularity",
    formula: "((1 − w) × stars × reviews + w × growth) ^ Google exponent × (1 + Foursquare factor × raw ^ Foursquare exponent)",
    requires: ["rating", "review_count"],
    query: "Nothing. Growth is read from Fast Update snapshots, not from the guest.",
    computation: "runtime",
    cost: "Local arithmetic over stored numbers, plus one cohort read of Fast Update snapshots.",
    missing: "No rating, no review count or 0 reviews: 0 (shown as n/a), so the place ranks last. No usable growth history (one snapshot, under 7 days, a changed Google listing, or history older than 90 days): w is 0, so Popularity is (stars × reviews) ^ Google exponent. Fewer than 8 peers with rising reviews in the city: the same, established only.",
    normalization: "None on the final score, on purpose (Pato, MESITA-2710: \"popularity can be above 1, it must not be normalized\"). Stars are linear. Growth is reviews per day over the observed span inside 90 days, at least 7 days apart, mapped onto the local established-base quantile, then mixed by w = 0.20 + 0.60 × min(observed days / 30, 1): 34% recent at 7 days and 80% recent at 30 days. It never goes above 80%. A watched place that did not gain reviews mixes in 0. The row’s Google exponent ranges from 0.1–1 (0.33 on Organic rows, 0.17 on Inorganic rows) and is applied once, after the mix. Foursquare then multiplies that result: 1 + factor × raw ^ exponent, using Foursquare’s own 0–1 popularity. Factor 1 allows up to 2×. A missing score or a measured 0 is 1×. Factor 0 turns it off. The default factor is 1 and the default exponent is 20. The score is a plain product, never clamped: Popularity × the Premier boost on the Map, × Proximity on the Catalog.",
  },
];

export const DISCOVERY_GATE_KEYS = ["family", "radius"] as const;
export type DiscoveryGateKey = (typeof DISCOVERY_GATE_KEYS)[number];

export type DiscoveryGateFact = {
  key: DiscoveryGateKey;
  label: string;
  rule: string;
  /** Intrinsic = a stored fact about the place; query = depends on the ask. */
  kind: "intrinsic" | "query";
  requires: readonly DiscoveryField[];
  when: string;
  missing: string;
  /** Sources that can apply the gate inside their own query. */
  pushdown: readonly DiscoverySourceKey[];
};

export const DISCOVERY_GATES: readonly DiscoveryGateFact[] = [
  {
    key: "family",
    label: "Family",
    rule: "1 when the place belongs to a requested family; 1 for every place when none is requested.",
    kind: "query",
    requires: ["family"],
    when: "When the guest picks one family: a chip on the Search map or a family row on Home; the score is the same as All.",
    missing: "No known family while a family is requested: 0.",
    pushdown: ["mesita_places"],
  },
  {
    key: "radius",
    label: "Radius",
    rule: "1 when the place lies inside the screen radius on the Map (the distance from the cross to the nearest edge of the visible map), else 0; Chat reads inside a fixed 15 km (the current-location radius knob retired in MESITA-3086). It decides who is a candidate and never scores. The Catalog has no radius (MESITA-2909).",
    kind: "query",
    requires: ["coordinates"],
    when: "Every Map request. Territory is gone (MESITA-2500, MESITA-2603): no view searches a rectangle or a saved area.",
    missing: "No coordinates: 0.",
    pushdown: ["mesita_places"],
  },
];

export const DISCOVERY_PIPELINE_KEYS = ["name", "map", "catalog", "deep"] as const;
export type DiscoveryPipelineKey = (typeof DISCOVERY_PIPELINE_KEYS)[number];

export type DiscoveryPipelineFact = {
  key: DiscoveryPipelineKey;
  label: string;
  purpose: string;
  sources: readonly DiscoverySourceKey[];
  signals: readonly DiscoverySignalKey[];
  gates: readonly DiscoveryGateKey[];
  scoring: string;
  /** Multipliers on the score that never exclude (the Map's and the
   *  Catalog's Premier since MESITA-2925, Selected from MESITA-2717; none
   *  from MESITA-2439 until then). */
  factors: readonly string[];
  /** Sources whose rows keep the source's own order: no signal scores them,
   *  so none is derived as feeding a signal. */
  keepsOrder: readonly DiscoverySourceKey[];
  /** Always-on eligibility rules that are not gates: they hold for every
   *  request and no guest asks for them. */
  rules: readonly string[];
  /** Who runs it: views, a bar, or the Chat Agent. Never a pipeline. */
  callers: readonly string[];
  /** False while no guest reaches it (its caller is a Soon screen): the
   *  admin draws its box as Soon, with no controls. */
  live: boolean;
};

export const DISCOVERY_PIPELINES: readonly DiscoveryPipelineFact[] = [
  {
    key: "name",
    label: "Name",
    purpose: "Resolve a place by its name or identity.",
    // Google's name is canonical (MESITA-2896): the Mesita Places lane and
    // the Name signal are gone. A place neither Google source returns is
    // not found; a Google hit Mesita holds shows as the Mesita place.
    sources: ["google_autocomplete", "google_text"],
    signals: [],
    gates: [],
    factors: [],
    scoring: "Google rows keep Google's order, except that on the guest bar Google places under the Name box's Minimum Popularity (read at the Catalog's root, MESITA-3086) sort after the rest (MESITA-2724). Autocomplete first, then Text Search; duplicates merge. A Google hit Mesita holds is shown as the Mesita place.",
    keepsOrder: ["google_autocomplete", "google_text"],
    rules: [
      "Closed places never show (Discovery › General's active check).",
      "A Google row must have a Google type of one of the thirty families, the only places Mesita can hold (hotels, shops and schools never show), and clear the old stored Google floors on rating, reviews and popularity (0 is off; no box edits them).",
      "Guest bar: Google places under the Minimum Popularity (this box's, MESITA-3086) sort after the rest; none are removed; 0 is off. A pick of one is card ONE like any other. Mesita places and Locations never move; admin is unaffected (MESITA-2724).",
    ],
    callers: ["The guest's Search bar", "Admin Single Place › Find", "Chat (Don Memo)"],
    live: true,
  },
  {
    key: "map",
    label: "Map",
    purpose: "Places on the guest's screen: the Map's cross and the circle that fits the visible map.",
    sources: ["mesita_places"],
    signals: ["popularity"],
    gates: ["family", "radius"],
    factors: [
      "Premier (MESITA-2925): the Premier boost (MESITA-4454), premierFactor ^ Premier exponent, premierFactor the paid plan (2 for 2X, 5 for 5X, 1 for every other place). Organic rows have Premier exponent 0, so a plan never moves the organic list.",
    ],
    scoring: "Popularity × s in two lanes (MESITA-4454), s the Premier boost (premierFactor ^ Premier exponent), a plain product never clamped or normalized (MESITA-2710). Organic: every place in the radius, scored with the Map Organic row (Premier exponent 0). Inorganic: Premier places only, scored with the Map Inorganic row. The two merge like Home's (one inorganic slot after every Inorganic cadence organic places, 0 = the Organic lane alone; a place shows once, and guests see it marked Ad only in an inorganic slot), with no Inorganic floor (the screen is the cut) and no shuffle. Popular and Family share the two Map rows. Distance is a screen, never a sort (Pato, MESITA-2909): the screen radius gates, Proximity is not read. The Map shows the top Map places shown, inorganic pins included. Ties break on id.",
    keepsOrder: [],
    rules: [
      "Mesita places only: Google Nearby Search is gone (MESITA-2872), so the Map calls no Google. Every ready Mesita place inside the screen radius is a candidate (the two 20-place source switches retired in MESITA-2909); the guest never picks a source.",
      "No Popularity floor (MESITA-3086: the Minimum Popularity orders the Name search bar only): a place with no Google numbers scores 0 and ranks last, never dropped.",
      "Closed places never show (Discovery › General's active check). Mesita rows must be ready.",
      "No reviews minimum (MESITA-2721) and no Popularity floor (MESITA-3086); the guest has no reviews filter (MESITA-2417).",
      "The screen radius is at least 0.05 km and has no ceiling (MESITA-2918): however far out the guest zooms, the search is the ring they see. No visible map yet uses a fixed 15 km instead (the current-location radius knob retired in MESITA-3086).",
      "Mesita's read ranks every ready place in the radius box (up to 10,000) and the Map shows the best Map places shown by score (MESITA-2950).",
    ],
    callers: ["Map (the Search tab)"],
    live: true,
  },
  {
    key: "catalog",
    label: "Catalog",
    purpose: "Every Mesita place, ranked for the guest's location: Home's Places.",
    sources: ["mesita_places"],
    signals: ["proximity", "popularity"],
    gates: ["family"],
    factors: [
      "Premier (MESITA-2925): the Premier boost (MESITA-4454), premierFactor ^ Premier exponent, premierFactor the paid plan (2 for 2X, 5 for 5X, 1 for every other place). Organic rows have Premier exponent 0, so a plan never moves the organic list.",
    ],
    scoring: "Proximity × Popularity × s in two lanes (MESITA-4454), s the Premier boost (premierFactor ^ Premier exponent), a plain product never clamped or normalized (MESITA-2710); Proximity is 1 ÷ (1 + (distance ÷ Half distance) ^ Distance exponent). A feed is what the guest sees; a lane is one ranked row inside it, and every lane has an Organic row and an Inorganic row (MESITA-4517, MESITA-4548). Nearby (Home's Nearby chip) is close + both; Popular (Home's Popular chip) is popular + both, every family; Family (a family chip) is close + well known + both of one family. Both is the places in the better half of the close ranking and of the well-known ranking, ordered by the worse of the two ranks; scores are never averaged. Organic rows score with Premier exponent 0; no repeat penalty (removed by MESITA-4463). Inorganic: Premier places only, scored with the mode's Inorganic row; a place takes an inorganic slot only when Proximity (its Inorganic row) × premierFactor reaches the Inorganic floor (default 0.2). The weave: each lane gives its batch (default 10) per weave, the organic batches taken one from each lane in turn (both first), one inorganic slot after every Inorganic cadence organic places (default 1, 0 = the organic lanes alone), taken in turn from the feed's Inorganic rows, each at most its batch per weave; a place already shown is skipped, a place shows once and guests see it marked Ad only in an inorganic slot; weaves repeat until the lanes run out. Then only the first weave is shuffled by the mode's Temperature (each place weighted 1 ÷ position^(1/T); 0 = the merged order exactly; Nearby 0.33, Family 0.5, Popular 1), both lanes together, with one seed per page load and mode (a reload shuffles again, MESITA-4463); everything after the first weave keeps its exact order. No radius: a far place is never cut, only lowered. No location: Proximity counts as 1. Chat ranks with the Family well-known row inside the current-location radius: no Inorganic lane, no shuffle. Pay, Wallet and the Reward tab rank by distance alone. Ties break on distance, then id.",
    keepsOrder: [],
    rules: [
      "Mesita places only, no Google call (MESITA-2872). The whole catalog is ranked in one run and Home gets every ranked id with the first page's cards, then reads the rest by id, one first-weave length at a time (MESITA-3057, MESITA-4517).",
      "No Popularity floor since MESITA-3086: a place with no Google numbers scores 0 and ranks last, never dropped.",
      "Closed places never show (Discovery › General's active check). Mesita rows must be ready.",
      "Mesita's read ranks every active place by score in one SQL statement, with no row cap (MESITA-3059), and hands Home the whole order; Home fills the next weave's cards at a time (MESITA-3057, MESITA-4517).",
      "Chat reads every ready Mesita place inside a fixed 15 km (Selected only until MESITA-2925; the current-location radius knob retired in MESITA-3086).",
    ],
    callers: ["Catalog (Home's Places)", "Chat (Don Memo)"],
    live: true,
  },
  {
    key: "deep",
    label: "Deep",
    purpose: "Open-ended, qualitative discovery: a request in the guest's own words.",
    sources: ["mesita_places", "mesita_social"],
    signals: ["description_similarity"],
    gates: [],
    factors: [],
    scoring: "Description, best first; ties break on name.",
    keepsOrder: [],
    rules: [
      "Closed places never show (Discovery › General's active check).",
      "Only ready profiles with a summary vector can be judged; the rest are left out.",
    ],
    callers: ["Chat (Don Memo)"],
    // Home's Chat pill is a Soon page: no guest reaches Deep (MESITA-2345).
    live: false,
  },
];

export function sourceByKey(key: DiscoverySourceKey): DiscoverySourceFact {
  const found = DISCOVERY_SOURCES.find((s) => s.key === key);
  if (!found) throw new Error(`unknown source ${key}`);
  return found;
}

export function signalByKey(key: DiscoverySignalKey): DiscoverySignalFact {
  const found = DISCOVERY_SIGNALS.find((s) => s.key === key);
  if (!found) throw new Error(`unknown signal ${key}`);
  return found;
}

/** DERIVED: a source can feed a signal or gate when it provides every field
 *  that signal or gate reads. */
export function sourceProvides(
  source: DiscoverySourceKey,
  fields: readonly DiscoveryField[],
): boolean {
  const provides = sourceByKey(source).provides;
  return fields.every((f) => provides.includes(f));
}

/** The pipeline's sources that feed this signal: derived from fields, minus
 *  the sources whose rows the pipeline keeps in their own order. */
export function sourcesFeedingSignal(
  pipeline: DiscoveryPipelineKey,
  signal: DiscoverySignalKey,
): DiscoverySourceKey[] {
  const p = DISCOVERY_PIPELINES.find((x) => x.key === pipeline);
  if (!p) return [];
  return p.sources.filter((s) =>
    !p.keepsOrder.includes(s) && sourceProvides(s, signalByKey(signal).requires)
  );
}

export function pipelinesUsingSignal(signal: DiscoverySignalKey): DiscoveryPipelineKey[] {
  return DISCOVERY_PIPELINES.filter((p) => p.signals.includes(signal)).map((p) => p.key);
}

export function pipelinesUsingGate(gate: DiscoveryGateKey): DiscoveryPipelineKey[] {
  return DISCOVERY_PIPELINES.filter((p) => p.gates.includes(gate)).map((p) => p.key);
}

export function pipelinesUsingSource(source: DiscoverySourceKey): DiscoveryPipelineKey[] {
  return DISCOVERY_PIPELINES.filter((p) => p.sources.includes(source)).map((p) => p.key);
}

export const CATALOG_FAMILY_FACTS: readonly { key: string; label: string; emoji: string }[] = [
  { key: "coffee", label: "Coffee", emoji: "☕" },
  { key: "breakfast", label: "Breakfast", emoji: "🍳" },
  { key: "bakery", label: "Bakery", emoji: "🥐" },
  { key: "sweet", label: "Dessert", emoji: "🍰" },
  { key: "healthy", label: "Healthy", emoji: "🥗" },
  { key: "quick_bite", label: "Quick", emoji: "⚡" },
  { key: "tacos", label: "Tacos", emoji: "🌮" },
  { key: "burgers", label: "Burgers", emoji: "🍔" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "chicken", label: "Wings", emoji: "🍗" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "mexican", label: "Mexican", emoji: "🇲🇽" },
  { key: "steak", label: "Steak", emoji: "🥩" },
  { key: "seafood", label: "Seafood", emoji: "🦐" },
  { key: "italian", label: "Italian", emoji: "🍝" },
  { key: "japanese", label: "Japanese", emoji: "🍱" },
  { key: "chinese", label: "Chinese", emoji: "🥡" },
  { key: "asian", label: "Asian", emoji: "🍥" },
  { key: "indian", label: "Indian", emoji: "🍛" },
  { key: "arabic", label: "Arabic", emoji: "🧆" },
  { key: "european", label: "European", emoji: "🥨" },
  { key: "american", label: "American", emoji: "🍟" },
  { key: "dinner", label: "Dinner", emoji: "🍽️" },
  { key: "fancy", label: "Fancy", emoji: "🥂" },
  { key: "drinks", label: "Bar", emoji: "🍻" },
  { key: "fun", label: "Fun", emoji: "🎯" },
  { key: "casino", label: "Casino", emoji: "🎰" },
  { key: "night_out", label: "Night", emoji: "🌙" },
  { key: "nightclub", label: "Club", emoji: "🪩" },
  { key: "music", label: "Music", emoji: "🎶" },
];
