// CIP — Consumer · Intent · Place. The playground's data plumbing for the
// scoring model (v10): build the consumer side, synthesize intents, and
// emulate the EM subscore until the real encoder (OpenAI embeddings) is wired.
//
// THREE DATA OBJECTS, TWO SIDES. Consumer-data and intent-data are the SAME
// side of the match (the query side) — merged before matching. The difference
// is mutability: consumer-data barely moves (taste, class), intent-data is
// per-query (tonight, near X, with friends). Place-data is the other side.
//
// How the five subscores get their inputs here:
//   EM  over (consumer + intent) doc × place doc — real consumer, synthetic
//       intent, real place; documents → vectors → cosine, max(0, cos).
//   SM  computed from (intent × place): haversine to the intent's W (zone
//       string match → km 0), the place's real hours vs the intent's query
//       time, and the category ladder — where × when × what.
//   GP  from the real place — ln(1 + rating × reviews) / ceiling.
//   RP  from the real place — posture derived from its live promo rates.
//   XX  a seeded unit draw per card per lane (scores.unitDraw), U^control.
//
// HONESTY RULES. Consumers and places come from the DB (via
// admin-web-get-scoring-sample) — never invented here. Intent is synthetic BY
// DESIGN (that's what an intent generator is). Consumer taste uses real
// saves/visits when they exist; an empty history gets a deterministic
// synthetic taste and is LABELED synthetic. EM here runs a feature-hash
// encoder — a deterministic stand-in for the real embedding model; the
// numbers are for exercising the model's shape, not for believing. SM's
// where emulates W as the anchor point + a zone string match (the zones
// registry / edge-distance geometry is the backend build), and the category
// ladder proxies mega-category siblings through tag overlap.

import type { WhatRelation } from "./scores";

/**
 * Synthetic intent STYLES — how the playground fabricates the query side.
 * There is only ONE engine (the Standard Engine); the surfaces differ only
 * in where intent-data comes from, and these styles emulate that:
 *   browse   — open-ended feed browsing (Swipe-shaped intent)
 *   viewport — spatial browsing around a viewport (Map-shaped intent)
 *   question — a concrete ask with category set (Memo-shaped intent)
 */
export type IntentStyle = "browse" | "viewport" | "question";

/** Max consumers/places the playground samples. Beyond ~10 the lists stop being readable. */
export const SAMPLE_MAX = 10;

// ── Sample types (shape of admin-web-get-scoring-sample) ───────────────

export type SampleConsumer = {
  id: string;
  label: string | null;
  class_key: string;
  instagram_followers: number | null;
  sex: string | null;
  age: number | null;
  country: string | null;
  saved_taste: string[];
  visited_taste: string[];
};

export type SamplePlace = {
  id: string;
  name: string;
  category: string | null;
  tags: string[] | null;
  zone: string | null;
  city: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  hours: Record<string, { open: string; close: string }[]> | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
};

// ── Consumer side ───────────────────────────────────────────────────────

export type ConsumerProfile = {
  consumer: SampleConsumer | null;
  /** The stable, barely-mutable side of the query. */
  tasteTokens: string[];
  /** True when taste (or the whole consumer) had to be synthesized. */
  synthetic: boolean;
};

// Taxonomy-flavored pool for synthetic taste when a consumer has no
// saves/visits (today: the whole catalog has zero of both).
const TASTE_POOL = [
  "night_club", "cocktail_bar", "rooftop", "live_music", "upscale", "trendy",
  "date_night", "brunch", "specialty_coffee", "tacos", "fine_dining",
  "wine_bar", "terrace", "speakeasy", "sports_bar", "casual",
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, "_");

export function buildConsumerProfile(c: SampleConsumer | null): ConsumerProfile {
  const real = [...new Set([...(c?.saved_taste ?? []), ...(c?.visited_taste ?? [])])].map(norm);
  if (c && real.length > 0) return { consumer: c, tasteTokens: real.slice(0, 12), synthetic: false };
  // Deterministic synthetic taste from the consumer id (or a fixed seed when
  // there is no consumer at all).
  const seed = hash(c?.id ?? "no-consumers");
  const taste: string[] = [];
  for (let i = 0; taste.length < 5 && i < 32; i++) {
    const t = TASTE_POOL[(seed + i * 7) % TASTE_POOL.length];
    if (!taste.includes(t)) taste.push(t);
  }
  return { consumer: c, tasteTokens: taste, synthetic: true };
}

// ── Intent side ─────────────────────────────────────────────────────────

export type Intent = {
  style: IntentStyle;
  /** The rendered prompt. Fixed structure for browse/viewport; flexible for question. */
  text: string;
  /**
   * The prompt decomposed by context key, so the configurable pipeline can
   * include/exclude each piece (intent.query / .zone / .time / .party).
   */
  parts: { query: string; zone: string | null; time: string; party: string | null };
  /** The zone the intent NAMES (SM's zone-mode string match) — null = point mode. */
  zoneName: string | null;
  /** The intent's category ask — a SET; empty = nothing asked (what → 1). */
  cats: string[];
  lat: number | null;
  lng: number | null;
  day: string;
  hour: number;
  timeLabel: string;
};

const DAYS = ["wednesday", "friday", "saturday", "sunday"] as const;
const HOURS = [13, 18.5, 20.5, 22.5] as const;

// The question style's flexible bank — occasion templates with their own
// natural time and category set. Browse/viewport never touch these: their
// prompt structure is fixed and only the data changes.
const QUESTION_BANK = [
  { text: "Where do I take a first date tonight?", hour: 20.5, day: "friday", cats: ["cocktail_bar", "wine_bar", "fine_dining"] },
  { text: "Best brunch for Sunday with my parents?", hour: 11, day: "sunday", cats: ["brunch"] },
  { text: "Where can we dance until late on Saturday?", hour: 23, day: "saturday", cats: ["night_club"] },
  { text: "Quiet spot to work over coffee this afternoon?", hour: 16, day: "wednesday", cats: ["specialty_coffee"] },
  { text: "Big group birthday dinner — where?", hour: 21, day: "saturday", cats: ["fine_dining", "casual"] },
  { text: "Rooftop drinks with a view before dinner?", hour: 19, day: "friday", cats: ["rooftop", "cocktail_bar"] },
] as const;

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Anchor the synthetic user near a real place: same city, walkable jitter. */
function anchor(places: SamplePlace[], seed: number): {
  lat: number | null;
  lng: number | null;
  near: string;
  zoneName: string | null;
} {
  const geo = places.filter((p) => p.lat != null && p.lng != null);
  if (geo.length === 0) return { lat: null, lng: null, near: "unknown", zoneName: null };
  const p = geo[seed % geo.length];
  const jitter = ((seed % 17) - 8) / 8; // −1..1
  return {
    lat: Number(p.lat) + jitter * 0.012, // ≈ ±1.3 km
    lng: Number(p.lng) + jitter * 0.01,
    near: p.zone ?? p.city ?? p.name,
    // The intent NAMES a zone only when the anchor place carries one — SM's
    // zone mode; otherwise the intent is a pure point (GPS mode).
    zoneName: p.zone ?? null,
  };
}

export function generateIntent(
  style: IntentStyle,
  profile: ConsumerProfile,
  places: SamplePlace[],
  seed: number,
): Intent {
  const a = anchor(places, seed);
  if (style === "question") {
    const t = QUESTION_BANK[seed % QUESTION_BANK.length];
    const parts = {
      query: t.text,
      zone: `near ${a.near}`,
      time: `${t.day} ${fmtHour(t.hour)}`,
      party: null,
    };
    return {
      style,
      text: t.text,
      parts,
      zoneName: a.zoneName,
      cats: [...t.cats],
      lat: a.lat,
      lng: a.lng,
      day: t.day,
      hour: t.hour,
      timeLabel: `${t.day} ${fmtHour(t.hour)}`,
    };
  }
  // Browse/viewport — FIXED prompt structure; only the data slots change.
  // No taste tokens here: taste/history are the spec's "ignored for now",
  // and party size is a filter's job — neither leaks into the embedded
  // intent.
  const day = DAYS[seed % DAYS.length];
  const hour = HOURS[seed % HOURS.length];
  const daypart = hour < 15 ? "lunch" : hour < 20 ? "evening" : "night";
  const parts = {
    query: `${style === "viewport" ? "viewport browse" : "feed browse"} · ${daypart} plans`,
    zone: style === "viewport" ? `viewport ≈2 km around ${a.near}` : `near ${a.near}`,
    time: `${day} ${fmtHour(hour)}`,
    party: null,
  };
  return {
    style,
    text: [parts.query, parts.zone, parts.time].filter(Boolean).join(" · "),
    parts,
    zoneName: a.zoneName,
    // Browse intents ask no category — the deck is open-ended (what → 1 for
    // every place); questions carry category sets.
    cats: [],
    lat: a.lat,
    lng: a.lng,
    day,
    hour,
    timeLabel: `${day} ${fmtHour(hour)}`,
  };
}

// ── SM inputs from the intent × place pair ──────────────────────────────

/**
 * where's inputs, emulated: zone mode when the intent names a zone — the
 * place's zone string matching it → km 0 (inside W); otherwise haversine to
 * the anchor. The real build measures border distance off the zones
 * registry's rectangles; the anchor-point distance is the playground's
 * stand-in.
 */
export function resolveWhere(
  intent: Intent,
  place: SamplePlace,
): { km: number | null; zoneMode: boolean } {
  const zoneMode = intent.zoneName != null;
  if (zoneMode && place.zone && place.zone === intent.zoneName) return { km: 0, zoneMode };
  if (intent.lat == null || intent.lng == null || place.lat == null || place.lng == null) {
    return { km: null, zoneMode };
  }
  return {
    km: haversineKm(intent.lat, intent.lng, Number(place.lat), Number(place.lng)),
    zoneMode,
  };
}

/**
 * The category ladder's resolution, emulated: exact when the place's category
 * is in the intent's set; sibling when a place TAG overlaps the set (tag
 * overlap proxies the mega-category family until the taxonomy's mega layer
 * is wired here); mismatch otherwise; none when nothing was asked.
 */
export function whatRelation(intent: Intent, place: SamplePlace): WhatRelation {
  if (intent.cats.length === 0) return "none";
  const cats = new Set(intent.cats.map(norm));
  if (place.category && cats.has(norm(place.category))) return "exact";
  if (Array.isArray(place.tags) && place.tags.some((t) => cats.has(norm(t)))) return "sibling";
  return "mismatch";
}

// ── when's inputs from real geo + real hours ────────────────────────────

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const DAY_ORDER = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

export type OpenWindow = {
  opensInH: number;
  openForH: number;
  /** True when the place has no usable hours data (≠ closed). */
  unknown: boolean;
};

/**
 * The place's real hours vs the intent's query time → SM's when-inputs.
 * Scans today + tomorrow (overnight closes roll past midnight), 12 h horizon.
 * No hours at all → unknown (the caller decides; unknown is not closed).
 */
export function openWindow(
  hours: SamplePlace["hours"],
  day: string,
  hour: number,
): OpenWindow {
  if (!hours || typeof hours !== "object" || Object.keys(hours).length === 0) {
    return { opensInH: 0, openForH: 0, unknown: true };
  }
  const di = DAY_ORDER.indexOf(day);
  const dayAt = (offset: number) => DAY_ORDER[(di + offset + 7) % 7];

  type Range = { start: number; end: number };
  const ranges: Range[] = [];
  for (const offset of [0, 1]) {
    for (const r of hours[dayAt(offset)] ?? []) {
      const open = parseHM(r.open);
      let close = parseHM(r.close);
      if (open == null || close == null) continue;
      if (close <= open) close += 24; // overnight
      ranges.push({ start: open + offset * 24, end: close + offset * 24 });
    }
  }
  const t = hour;
  const HORIZON = 12;
  let best: OpenWindow | null = null;
  for (const r of ranges) {
    if (t >= r.start && t < r.end) {
      return { opensInH: 0, openForH: r.end - t, unknown: false };
    }
    if (r.start > t && r.start - t <= HORIZON) {
      const cand = { opensInH: r.start - t, openForH: r.end - r.start, unknown: false };
      if (!best || cand.opensInH < best.opensInH) best = cand;
    }
  }
  // Closed for the whole horizon.
  return best ?? { opensInH: HORIZON, openForH: 0, unknown: false };
}

// ── CONTEXT DOCUMENTS — the wide embedding contexts, assembled for real ──
// These are the documents the real pipeline will embed for EM: everything is
// TEXT — hours and zones appear as words; numeric distance/time live only in
// SM, numeric proof only in GP. WHICH fields go in is CONFIG
// (scores.CONTEXT_FIELDS + the saved ContextConfig): every builder takes an
// `enabled` key set and assembles from exactly that — so a toggle on the
// Subscores tab changes the embedding, the cosine, and the ranking. `enabled`
// omitted = all on.

type Enabled = ReadonlySet<string> | null | undefined;
const on = (enabled: Enabled, key: string) => !enabled || enabled.has(key);

/**
 * The consumer half of the CI document — barely-mutable side. Spec fields
 * ONLY: name · sex · age · country · class+why. Taste and history are the
 * spec's "ignored for now" — never embedded, whatever the toggles say.
 * `sourceOn` = the data-access matrix's em×consumer cell.
 */
export function buildConsumerDoc(
  profile: ConsumerProfile,
  enabled?: Enabled,
  sourceOn = true,
): string {
  if (!sourceOn) return "";
  const c = profile.consumer;
  const igWhy =
    c?.instagram_followers != null && c.instagram_followers > 0 ? "IG-invited" : "subscribed";
  return [
    on(enabled, "consumer.name") ? (c?.label ?? "Anonymous consumer") : "Consumer",
    on(enabled, "consumer.sex") ? (c?.sex ?? null) : null,
    on(enabled, "consumer.age") && c?.age != null ? `${c.age} years old` : null,
    on(enabled, "consumer.country") ? (c?.country ?? null) : null,
    on(enabled, "consumer.class") ? `${c?.class_key ?? "free"} class (${igWhy})` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The full CI document — consumer (stable) + intent (per-query), merged.
 * `sources` gates whole sides per the data-access matrix (default all on). */
export function buildCiDoc(
  profile: ConsumerProfile,
  intent: Intent,
  enabled?: Enabled,
  sources?: { consumer?: boolean; intent?: boolean },
): string {
  const intentBits =
    sources?.intent === false
      ? []
      : [
          on(enabled, "intent.query") ? intent.parts.query : null,
          on(enabled, "intent.zone") ? intent.parts.zone : null,
          on(enabled, "intent.time") ? intent.parts.time : null,
        ].filter(Boolean);
  const consumerDoc = buildConsumerDoc(profile, enabled, sources?.consumer !== false);
  return [consumerDoc, intentBits.length > 0 ? `Intent: ${intentBits.join(" · ")}` : ""]
    .filter(Boolean)
    .join("\n");
}

/** The place document — what the Enricher's profile embeds. Spec fields
 * ONLY: name · category · tags · description · zone & city (+ reviews
 * summary and price when the data exists). Rating/hours are ROUTED to
 * GP/SM — numeric, never embedded here. */
export function buildPlaceDoc(p: SamplePlace, enabled?: Enabled, sourceOn = true): string {
  if (!sourceOn) return "";
  const head = [
    on(enabled, "place.name") ? p.name : null,
    on(enabled, "place.category") && p.category ? `a ${p.category.replace(/_/g, " ")}` : null,
    on(enabled, "place.zone_city") ? [p.zone, p.city].filter(Boolean).join(", ") || null : null,
  ]
    .filter(Boolean)
    .join(" — ");
  const tags =
    on(enabled, "place.tags") && Array.isArray(p.tags) && p.tags.length > 0
      ? `Tags: ${p.tags.join(", ")}.`
      : "";
  const desc = on(enabled, "place.description") && p.description ? p.description : "";
  return [head, tags, desc].filter(Boolean).join("\n");
}

// ── EMULATED EMBEDDINGS — feature-hashed bag-of-tokens ──────────────────
// A deterministic stand-in for the real encoder (OpenAI
// text-embedding-3-small): tokenize the document, hash every token into a
// signed slot of a fixed-dim vector, L2 normalize. Same shape as the real
// thing (document → unit vector → dot product), so EM IS the cosine of two
// generated vectors — just from a toy encoder.

export const EMBED_DIMS = 64;

const STOP = new Set([
  "the", "and", "for", "with", "near", "around", "from", "this", "that",
  "una", "unos", "las", "los", "del", "por", "para", "con",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_áéíóúñü]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** Document → deterministic unit vector (feature hashing, signed slots). */
export function embedText(text: string, dims = EMBED_DIMS): number[] {
  const v = new Array<number>(dims).fill(0);
  for (const t of tokenize(text)) {
    const h = hash(t);
    const idx = h % dims;
    const sign = (h >>> 16) & 1 ? 1 : -1;
    v[idx] += sign;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? v.map((x) => x / norm) : v;
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i] * b[i];
  return dot;
}

/** EM from the two vectors — max(0, cos), in [0,1]. */
export function emFromVectors(ciVec: number[], placeVec: number[]): number {
  return Math.max(0, Math.min(1, cosineSim(ciVec, placeVec)));
}
