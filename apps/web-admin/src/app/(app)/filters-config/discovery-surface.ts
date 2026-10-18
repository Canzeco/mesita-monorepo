// ADMIN TWIN of supabase/functions/_shared/discovery-surface.ts (Vercel's
// root is apps/web-admin, so the console cannot import the server file).
// discovery-surface.contract.test.ts pins every shared export equal; the Feed
// rail facts at the bottom are the console's own.
//
// What Discovery IS (MESITA-2327): five Sources, three Pipelines, four
// Signals, two Gates, and who uses whom.
//
//   Source    a callable retrieval unit with declared output fields
//   Pipeline  orchestrates sources, gates and signals (Name · Area · Deep)
//   Signal    a continuous score in 0..1
//   Gate      a binary eligibility check (0 or 1)
//
// Catalog and Map are VIEWS of Area, not pipelines; Favorites is a saved
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
    retrieves: "The closest Google places of the requested families: one call of 20.",
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
    formula: "2^(−distance ÷ half distance)",
    requires: ["coordinates"],
    query: "The area's anchor: the device, a city, a pin or the map's centre.",
    computation: "runtime",
    cost: "Local arithmetic, free.",
    missing: "No anchor: 1 for every place (abstains). No coordinates: 0.",
    normalization: "0..1 by construction: 1 at the anchor, ½ at the half distance, ¼ at twice it.",
  },
  {
    key: "popularity",
    label: "Popularity",
    formula: "clamp(ln(1 + rating × reviews) ÷ ln(1 + reference rating × reference reviews), 0, 1)",
    requires: ["rating", "review_count"],
    query: "Nothing.",
    computation: "runtime",
    cost: "Local arithmetic over stored numbers, free.",
    missing: "No rating or no review count: 0. There is no new-place prior.",
    normalization: "Divided by the reference's raw value and clamped to 0..1, so it multiplies with Proximity on the same scale.",
  },
];

export const DISCOVERY_GATE_KEYS = ["selected", "family"] as const;
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
    key: "selected",
    label: "Selected",
    rule: "1 when the place is Mesita Selected (an Enrich run completed and the profile is ready), else 0.",
    kind: "intrinsic",
    requires: ["selected"],
    when: "Only in the Mesita Selected scope; the Google Places scope admits every place.",
    missing: "Unknown is not Selected: 0.",
    pushdown: ["mesita_places"],
  },
  {
    key: "family",
    label: "Family",
    rule: "1 when the place belongs to a requested family; 1 for every place when none is requested.",
    kind: "query",
    requires: ["family"],
    when: "When the guest picks families on the map, or a Feed row is a family.",
    missing: "No known family while a family is requested: 0.",
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
  /** Sources whose rows keep the source's own order: no signal scores them,
   *  so none is derived as feeding a signal. */
  keepsOrder: readonly DiscoverySourceKey[];
  /** Always-on eligibility rules that are not gates: they hold for every
   *  request and no guest asks for them. */
  rules: readonly string[];
  /** Who runs it: views, a bar, or the Chat Agent. Never a pipeline. */
  callers: readonly string[];
};

export const DISCOVERY_PIPELINES: readonly DiscoveryPipelineFact[] = [
  {
    key: "name",
    label: "Name",
    purpose: "Resolve a place by its name or identity.",
    sources: ["google_autocomplete", "google_text", "mesita_places"],
    signals: ["name_similarity"],
    gates: [],
    scoring: "Google rows keep Google's order; Mesita rows are ordered by Name. Duplicates merge.",
    keepsOrder: ["google_autocomplete", "google_text"],
    rules: [
      "Closed places never show (Discovery › General's active check).",
      "A Google row must have a Google type of one of the fifteen families, the only places Mesita can hold (hotels, shops and schools never show), and clear the stored Google floors (map.minRating, minReviews, minPopularity; 0 is off and no box edits them).",
      "Discovery › General's reviews floor (people, never stars; 0 is off) cuts Google and Mesita rows.",
    ],
    callers: ["The guest's Search bar", "Admin Single Place › Find", "Chat (Don Memo)"],
  },
  {
    key: "area",
    label: "Area",
    purpose: "Places around an anchor: the device, a picked city, a searched destination, a dropped pin or the map's centre.",
    sources: ["google_nearby", "mesita_places"],
    signals: ["proximity", "popularity"],
    gates: ["selected", "family"],
    scoring: "Family × Selected × Proximity × Popularity. Exponents 1, no weights; ties break on distance.",
    keepsOrder: [],
    rules: [
      "Closed places never show (Discovery › General's active check).",
      "Inside the radius: it decides who is a candidate and never scores.",
      "Google Places scope only: the guest's Google Reviews stop (10+ · 100+ · 1,000+, default 100+) or the operator's floor, whichever is higher. Mesita Selected has no review floor.",
    ],
    callers: ["Map (the Search tab)", "Catalog (Home's Feed)", "Chat (Don Memo)"],
  },
  {
    key: "deep",
    label: "Deep",
    purpose: "Open-ended, qualitative discovery: a request in the guest's own words.",
    sources: ["mesita_places", "mesita_social"],
    signals: ["description_similarity"],
    gates: [],
    scoring: "Description, best first; ties break on name.",
    keepsOrder: [],
    rules: [
      "Closed places never show (Discovery › General's active check).",
      "Only ready profiles with a summary vector can be judged; the rest are left out.",
    ],
    callers: ["Chat (Don Memo)"],
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
  { key: "go_out", label: "Go out", emoji: "🎟️" },
  { key: "move", label: "Move", emoji: "🏃" },
  { key: "feel_better", label: "Feel better", emoji: "💆" },
];

// The Feed's rows, top to bottom: the Catalog view of the Area pipeline
// (consumer-web-list-catalog, `_shared/area-pipeline.ts` +
// `_shared/catalog-rank.ts`): Google Places, Mesita Selected, then one row
// per guest family in CATALOG_FAMILY_FACTS order, Mesita Selected members
// only. Every row stops at the operator's Places per row and an empty row is
// omitted. The supabase contract test pins these against buildCatalogRails.

export const CATALOG_SIGNAL_RAILS: readonly {
  key: string;
  label: string;
  emoji: string;
  holds: string;
  order: string;
}[] = [
  {
    key: "google_places",
    label: "Google Places",
    emoji: "📍",
    holds:
      "The Google Places scope around the guest: one Nearby call inside the radius, 100+ Google reviews or the operator's floor; a Mesita place wins its own Google id. Needs a location, Google fill on and budget, else the row hides. The only row Google appears in.",
    order: "The Area score: Proximity × Popularity.",
  },
  {
    key: "mesita_selected",
    label: "Mesita Selected",
    emoji: "✨",
    holds:
      "The Mesita Selected scope: every Selected place inside the radius. No review floor.",
    order: "The Area score: Proximity × Popularity.",
  },
];
