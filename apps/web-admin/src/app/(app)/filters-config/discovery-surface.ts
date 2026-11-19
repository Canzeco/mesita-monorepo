// ADMIN TWIN of supabase/functions/_shared/discovery-surface.ts (Vercel's
// root is apps/web-admin, so the console cannot import the server file).
// discovery-surface.contract.test.ts pins every shared export equal; the Feed
// rail facts at the bottom are the console's own.
//
// What Discovery IS (MESITA-2327): five Sources, four Pipelines, four
// Signals, two Gates, one Factor (Premier, MESITA-2925), and who uses whom.
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
    formula: "(stars ^ Stars exponent × reviews) ^ Google exponent",
    requires: ["rating", "review_count"],
    query: "Nothing.",
    computation: "runtime",
    cost: "Local arithmetic over stored numbers, free.",
    missing: "No rating, no review count or 0 reviews: 0 (shown as n/a), so the place ranks last. There is no new-place prior; that lowers the place, it never removes it.",
    normalization: "None, on purpose (Pato, MESITA-2710: \"popularity can be above 1, it must not be normalized\"). Both exponents are the recipe row's (MESITA-4454): Stars exponent 0–4 (2 on every row: stars count squared), Google exponent 0.1–1 (0.33 on Organic rows, the cube root: every 8× the reviews doubles it; 0.17 on Inorganic rows, which squeezes famous and unknown places together so the plan decides more). It replaced (1 + reviews × stars)^root × (stars ÷ 5)^weight (MESITA-3083, MESITA-4153). The score is a plain product, never clamped: Popularity × the Premier boost on the Map, × Proximity on the Catalog.",
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
      "A Google row must have a Google type of one of the thirty-seven families, the only places Mesita can hold (hotels, shops and schools never show), and clear the old stored Google floors on rating, reviews and popularity (0 is off; no box edits them).",
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
    scoring: "Popularity × s in two lanes (MESITA-4454), s the Premier boost (premierFactor ^ Premier exponent), a plain product never clamped or normalized (MESITA-2710). Organic: every place in the radius, scored with the Map Organic row (Premier exponent 0). Inorganic: Premier places only, scored with the Map Inorganic row. The two merge like Home's (one ad slot after every ad cadence organic places, 0 = no ads; a place shows once, and wears Ad only in an ad slot), with no ad floor (the screen is the cut) and no shuffle. Popular and Family share the two Map rows. Distance is a screen, never a sort (Pato, MESITA-2909): the screen radius gates, Proximity is not read. The Map shows the top Map places shown, ad pins included. Ties break on id.",
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
    scoring: "Proximity × Popularity × s in two lanes (MESITA-4454), s the Premier boost (premierFactor ^ Premier exponent), a plain product never clamped or normalized (MESITA-2710); Proximity is 1 ÷ (1 + (distance ÷ Half distance) ^ Distance exponent). Each mode reads its own pair of recipe rows: Nearby (Home's Nearby chip), Family (a family chip) and Popular (Home's Popular chip). Organic: every place, scored with the mode's Organic row (Premier exponent 0); the repeat penalty applies here only, never on Nearby (each place's kind is its rarest family and the n-th place of a kind × the repeat penalty^(n − 1)). Inorganic: Premier places only, scored with the mode's Inorganic row; a place takes an ad slot only when Proximity (its Inorganic row) × premierFactor reaches the ad floor (default 0.2). The merge: one ad slot after every ad cadence organic places (default 1, 0 = no ads); a place already shown is skipped, an ad slot with no Premier place left is dropped, a place shows once and wears Ad only in an ad slot. Then only the first page (the page size) is shuffled by the mode's Temperature (each place weighted 1 ÷ position^(1/T); 0 = the merged order exactly; Nearby 0.33, Family 0.5, Popular 1), ads and organic places together, with one seed per guest visit and mode; everything after the first page keeps its exact order. No radius: a far place is never cut, only lowered. No location: Proximity counts as 1. Chat ranks with the Family Organic row inside the current-location radius: no ads, no shuffle. Pay, Wallet and the Reward tab rank by distance alone. Ties break on distance, then id.",
    keepsOrder: [],
    rules: [
      "Mesita places only, no Google call (MESITA-2872). The whole catalog is ranked in one run and Home gets every ranked id with the first page's cards, then reads the rest by id a Catalog page size at a time (MESITA-2909, MESITA-3057).",
      "No Popularity floor since MESITA-3086: a place with no Google numbers scores 0 and ranks last, never dropped.",
      "Closed places never show (Discovery › General's active check). Mesita rows must be ready.",
      "Mesita's read ranks every active place by score in one SQL statement, with no row cap (MESITA-3059), and hands Home the whole order; Home fills `map.catalogPageSize` cards at a time (MESITA-2921, MESITA-3057).",
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

export function gateByKey(key: DiscoveryGateKey): DiscoveryGateFact {
  const found = DISCOVERY_GATES.find((g) => g.key === key);
  if (!found) throw new Error(`unknown gate ${key}`);
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
  { key: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { key: "drinks", label: "Bar", emoji: "🍻" },
  { key: "sports", label: "Sports", emoji: "📺" },
  { key: "hookah", label: "Hookah", emoji: "💨" },
  { key: "night_out", label: "Night", emoji: "🌙" },
  { key: "nightclub", label: "Club", emoji: "🪩" },
  { key: "music", label: "Music", emoji: "🎶" },
  { key: "karaoke", label: "Karaoke", emoji: "🎤" },
  { key: "fun", label: "Fun", emoji: "🎯" },
  { key: "cinema", label: "Cinema", emoji: "🎬" },
  { key: "casino", label: "Casino", emoji: "🎰" },
  { key: "spa", label: "Spa", emoji: "🧖" },
  { key: "tourist", label: "Tourism", emoji: "🏛️" },
];
