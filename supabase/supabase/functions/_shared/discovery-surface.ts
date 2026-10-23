// What Discovery IS (MESITA-2327): five Sources, three Pipelines, four
// Signals (Selected left the score with MESITA-2703), two Gates, and who uses whom. The admin console renders this file
// (its twin, apps/web-admin filters-config/discovery-surface.ts, is pinned
// equal by discovery-surface.contract.test.ts) and discovery-surface.test.ts
// checks it against the call sites, so the page cannot describe an engine
// that does not exist.
//
//   Source    a callable retrieval unit with declared output fields
//   Pipeline  orchestrates sources, gates and signals (Name · Area · Deep)
//   Signal    a continuous score in 0..1
//   Gate      a binary eligibility check (0 or 1)
//   Factor    a multiplier on the score: it orders, never excludes (none
//             since MESITA-2439)
//
// Catalog and Map are VIEWS of Area, not pipelines; Saved is a saved
// collection; the Chat Agent sits above the pipelines and calls Deep, never a
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
  "name_embedding",
  "description_embedding",
  "about",
  "selected",
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
  name_embedding: "Name embedding",
  description_embedding: "Description embedding",
  about: "About",
  selected: "Selected",
  event: "Events",
};

export const DISCOVERY_SOURCE_KEYS = [
  "google_autocomplete",
  "google_text",
  "google_nearby",
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
    key: "google_nearby",
    label: "Google Nearby Search",
    retrieves: "Up to 20 Google places of the requested families per call, ranked by prominence or by distance inside a circle.",
    provides: GOOGLE_LISTING,
    live: true,
  },
  {
    key: "mesita_places",
    label: "Mesita Places Search",
    retrieves: "Mesita's own places, queried by name, by area or by meaning, as each pipeline needs.",
    provides: [
      "place_id",
      "name",
      "address",
      "coordinates",
      "rating",
      "review_count",
      "family",
      "name_embedding",
      "description_embedding",
      "about",
      "selected",
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
  "name_similarity",
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
    key: "name_similarity",
    label: "Name",
    formula: "cosine(query name embedding, place name embedding)",
    requires: ["name"],
    query: "The typed name.",
    computation: "hybrid",
    cost: "Place vectors are precomputed; one embedding call per request, the cosine runs locally.",
    missing: "No embedding on either side: lexical trigram similarity instead, never a silent 0.",
    normalization: "A cosine clamped to 0..1 (a negative one is 0); the lexical score is already 0..1. A Mesita row needs 0.4 by either method.",
  },
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
    formula: "1 ÷ (1 + distance ÷ distance for half credit)",
    requires: ["coordinates"],
    query: "A point location: the Map's cross, the device or a saved pin.",
    computation: "runtime",
    cost: "Local arithmetic, free.",
    missing: "No location: not used (n/a). No coordinates: 0.",
    normalization: "0..1 by construction: 1 at the point, ½ at the operator's distance for half credit (default 10 km), ⅓ at twice it, never 0 (MESITA-2706). That distance never follows the request's radius: a tight Map screen is nearly flat and Popularity decides, Home's 15 km circle bites (0.40 at the edge). The radius only decides who is a candidate.",
  },
  {
    key: "popularity",
    label: "Popularity",
    formula: "ln(1 + reviews × stars)",
    requires: ["rating", "review_count"],
    query: "Nothing.",
    computation: "runtime",
    cost: "Local arithmetic over stored numbers, free.",
    missing: "No rating or no review count: 0 (shown as n/a). There is no new-place prior; that lowers the place, it never removes it.",
    normalization: "None, on purpose (Pato, MESITA-2710: \"popularity can be above 1, it must not be normalized\"): 4.6★ × 1,000 reviews ≈ 8.4, 4.0★ × 30 ≈ 4.8. The 1 + keeps a place with no reviews at 0. The score is a plain product, Proximity^a × Popularity^b, never clamped.",
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
    when: "When the guest picks one family: a chip on the Search map or a family row on Home. The family also asks Google for its own place types (never another family's subtypes) and lists its primary places before its secondary ones; the score is the same as All.",
    missing: "No known family while a family is requested: 0.",
    pushdown: ["google_nearby", "mesita_places"],
  },
  {
    key: "radius",
    label: "Radius",
    rule: "1 when the place lies inside the radius around the point, else 0: on the Map the screen radius (the distance from the cross to the nearest edge of the visible map), on Home the radius saved with the pin or the current-location radius below. It decides who is a candidate and never scores.",
    kind: "query",
    requires: ["coordinates"],
    when: "Every request with a point. Territory is gone (MESITA-2500, MESITA-2603): no view searches a rectangle or a saved area, so Home sends a point or nothing.",
    missing: "No coordinates: 0.",
    pushdown: ["google_nearby", "mesita_places"],
  },
];

export const DISCOVERY_PIPELINE_KEYS = ["name", "area", "deep"] as const;
export type DiscoveryPipelineKey = (typeof DISCOVERY_PIPELINE_KEYS)[number];

export type DiscoveryPipelineFact = {
  key: DiscoveryPipelineKey;
  label: string;
  purpose: string;
  sources: readonly DiscoverySourceKey[];
  signals: readonly DiscoverySignalKey[];
  gates: readonly DiscoveryGateKey[];
  scoring: string;
  /** Multipliers on the score that never exclude (none since MESITA-2439). */
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
    sources: ["google_autocomplete", "google_text", "mesita_places"],
    signals: ["name_similarity"],
    gates: [],
    factors: [],
    scoring: "Google rows keep Google's order; Mesita rows are ordered by Name. Duplicates merge.",
    keepsOrder: ["google_autocomplete", "google_text"],
    rules: [
      "Closed places never show (Discovery › General's active check).",
      "A Google row must have a Google type of one of the twelve families, the only places Mesita can hold (hotels, shops and schools never show), and clear the old stored Google floors on rating, reviews and popularity (0 is off; no box edits them).",
      "Google rows only: the Area box's Minimum Google reviews, the one reviews floor (people, never stars; 0 is off, MESITA-2702). Mesita rows have no review floor.",
    ],
    callers: ["The guest's Search bar", "Admin Single Place › Find", "Chat (Don Memo)"],
    live: true,
  },
  {
    key: "area",
    label: "Area",
    purpose: "Places around a point: the Map's cross, the device or a saved pin.",
    sources: ["google_nearby", "mesita_places"],
    signals: ["proximity", "popularity"],
    gates: ["family", "radius"],
    factors: [],
    scoring: "The Map and Home: Proximity^a × Popularity^b, a and b the operator's Proximity and Popularity weights (MESITA-2703), a plain product never clamped or normalized (MESITA-2710); Proximity is ½ at the operator's distance for half credit, the same inside the Map's screen radius and Home's circle (MESITA-2706), and the radius only gates. No location: Popularity^b. Chat ranks the same way inside the current-location radius. Ties break on distance, then id.",
    keepsOrder: [],
    rules: [
      "Four sources, each switched on (20) or off (0) by the operator, Home and the Map alike: Google Popular (the prominent 20 in the circle), Google Closest (the nearest 20), Mesita Popular (the 20 with the highest Popularity), Mesita Closest (the 20 nearest). They merge into one pool, deduped by Google Place ID (a Mesita place wins its own Google id), gated, scored and ranked before any page is cut. The guest never picks a source. Home and the Map show the top Places shown of that sorted pool (1–80, default 20, MESITA-2713). Before that cut, a place whose Popularity, ln(1 + reviews × stars), is under the Minimum Popularity (default 3; 0 is off, MESITA-2714) is dropped, Google or Mesita, Selected or not.",
      "Closed places never show (Discovery › General's active check). Mesita rows must be ready.",
      "Google hits only: the operator's Minimum Google reviews (below); the guest has no reviews filter (MESITA-2417). Mesita rows have no review floor.",
      "Google calls: one billed Nearby call per Google source switched on, so 0 to 2 per load on the Map and on Home. The reviews floor cuts each call's hits after Google bills them. A place two calls return counts once.",
      "Google answers live 15 s in the function's memory and are never stored (Google Maps Platform terms). Each guest IP may spend 45 Nearby calls a minute, all guests together 600.",
      "The screen radius is clamped to 0.05–50 km; a visible map wider than 100 km, or none yet, uses the current-location radius instead. A saved pin's radius is clamped to 1–50 km.",
      "Mesita's read keeps at most 1000 ready rows in the radius box before scoring.",
      "Chat reads Mesita Selected places only, inside the current-location radius.",
    ],
    callers: ["Map (the Search tab)", "Catalog (Home's Places)", "Chat (Don Memo)"],
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
  { key: "breakfast", label: "Breakfast", emoji: "🥐" },
  { key: "quick_bite", label: "Quick bite", emoji: "🥙" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "tacos", label: "Tacos", emoji: "🌮" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "burgers", label: "Burgers", emoji: "🍔" },
  { key: "noodles", label: "Noodles", emoji: "🍜" },
  { key: "dinner", label: "Dinner", emoji: "🍝" },
  { key: "sweet", label: "Sweet", emoji: "🍰" },
  { key: "drinks", label: "Drinks", emoji: "🍸" },
  { key: "night_out", label: "Night out", emoji: "🌙" },
];
