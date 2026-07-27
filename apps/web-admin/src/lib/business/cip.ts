// CIP — Consumer · Intent · Place. The playground's data plumbing for the
// scoring model (v11): build the consumer side, compose intents, and
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
//       string match → km 0), the place's real hours as a binary 2×24×7
//       openness array from intent time (when's PARAM), and the category
//       ladder — where × when × what.
//   GP  from the real place — ln(1 + rating^pow × reviews) / ceiling.
//   RP  from the real place — strategy derived from its live promo rates.
//   XX  a seeded unit draw per card per lane (scores.unitDraw), U^control.
//
// HONESTY RULES. Consumers and places come from the DB (via
// admin-web-get-scoring-sample) — never invented here. Intent is
// OPERATOR-AUTHORED (composeIntent — the Playground's Where · When · What ·
// That composer; nothing about it is sampled). Consumer taste uses real
// saves/visits when they exist; an empty history gets a deterministic
// synthetic taste and is LABELED synthetic. EM here runs a feature-hash
// encoder — a deterministic stand-in for the real embedding model; the
// numbers are for exercising the model's shape, not for believing. SM's
// where emulates W as the anchor point + a zone string match (the zones
// registry / edge-distance geometry is the backend build), and the category
// ladder proxies mega-category siblings through tag overlap.

import {
  OPENNESS_DAYS,
  OPENNESS_SLOTS,
  TIME_BLOCK_H,
  type WhatRelation,
} from "./scores";

/**
 * The operator's intent, decomposed along its REAL axes — exactly what a
 * Lineup caller supplies. Where/When/What feed SM's structured checks; That
 * (the free-text ask) is the TEXT half, EM's query.
 */
export type IntentSpec = {
  /** That — the free-text ask. Empty = open-ended browse. */
  ask: string;
  /** Where — a NAMED zone (SM zone mode) or null = point mode near an anchor. */
  zoneName: string | null;
  /** When — full weekday name + hour on the 30-min grid. */
  day: string;
  hour: number;
  /** What — the category ask, a SET; empty = nothing asked (what → 1). */
  cats: string[];
};

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

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
  /** MP subscore — operator priority [0,1]; null → DEFAULT_MANUAL_PRIORITY. */
  manual_priority: number | null;
};

// ── Consumer side ───────────────────────────────────────────────────────

type ConsumerProfile = {
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
  /** The rendered prompt — the ask · the where · the when, joined. */
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

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * The operator's spec → a full Intent. W resolution: a NAMED zone centers on
 * a sample place in that zone (its places string-match to km 0; others
 * measure spillover from that center); point mode anchors near the first
 * geo place with a small fixed offset (~0.8 km) so no place sits exactly on
 * W. Taste/history/party never enter — same spec rules as production.
 */
export function composeIntent(spec: IntentSpec, places: SamplePlace[]): Intent {
  const geo = places.filter((p) => p.lat != null && p.lng != null);
  const zonePlace = spec.zoneName ? (geo.find((p) => p.zone === spec.zoneName) ?? null) : null;
  const anchorPlace = zonePlace ?? geo[0] ?? null;
  const near =
    spec.zoneName ?? anchorPlace?.zone ?? anchorPlace?.city ?? anchorPlace?.name ?? "unknown";
  const ask = spec.ask.trim();
  const parts = {
    query: ask || "open-ended browse",
    zone: `near ${near}`,
    time: `${spec.day} ${fmtHour(spec.hour)}`,
    party: null,
  };
  return {
    text: [parts.query, parts.zone, parts.time].join(" · "),
    parts,
    zoneName: spec.zoneName,
    cats: [...spec.cats],
    lat: anchorPlace?.lat != null ? Number(anchorPlace.lat) + 0.006 : null,
    lng: anchorPlace?.lng != null ? Number(anchorPlace.lng) + 0.005 : null,
    day: spec.day,
    hour: spec.hour,
    timeLabel: `${spec.day} ${fmtHour(spec.hour)}`,
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

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
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

type OpenWindow = {
  opensInH: number;
  openForH: number;
  /** True when the place has no usable hours data (≠ closed). */
  unknown: boolean;
};

type OpennessResult = OpenWindow & {
  /** Binary 2×24×7 half-hour openness from intent time — when's PARAM. null when unknown. */
  bits: boolean[] | null;
};

/**
 * Build the when PARAM: a binary openness array of OPENNESS_SLOTS (2×24×7)
 * half-hour blocks starting at the intent's day+hour. Each bit is whether the
 * place is open in that slot. Derived opensInH / openForH stay for anatomy.
 * No hours at all → unknown (bits null; the caller treats when as 1).
 */
export function buildOpennessArray(
  hours: SamplePlace["hours"],
  day: string,
  hour: number,
): OpennessResult {
  if (!hours || typeof hours !== "object" || Object.keys(hours).length === 0) {
    return { bits: null, opensInH: 0, openForH: 0, unknown: true };
  }
  const di = DAY_ORDER.indexOf(day);
  if (di < 0) return { bits: null, opensInH: 0, openForH: 0, unknown: true };

  // Ranges in hours from the start of the intent day, covering the full
  // week horizon. Overnight closes (close ≤ open) spill +24 into the next day.
  type Range = { start: number; end: number };
  const ranges: Range[] = [];
  for (let offset = 0; offset < OPENNESS_DAYS; offset++) {
    const d = DAY_ORDER[(di + offset) % 7];
    for (const r of hours[d] ?? []) {
      const open = parseHM(r.open);
      let close = parseHM(r.close);
      if (open == null || close == null) continue;
      if (close <= open) close += 24;
      ranges.push({ start: open + offset * 24, end: close + offset * 24 });
    }
  }

  const t0 = hour;
  const bits = new Array<boolean>(OPENNESS_SLOTS).fill(false);
  for (let i = 0; i < OPENNESS_SLOTS; i++) {
    const slotMid = t0 + i * TIME_BLOCK_H + TIME_BLOCK_H / 2;
    for (const r of ranges) {
      if (slotMid >= r.start && slotMid < r.end) {
        bits[i] = true;
        break;
      }
    }
  }

  let opensInSlots: number | null = null;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      opensInSlots = i;
      break;
    }
  }
  if (opensInSlots == null) {
    return {
      bits,
      unknown: false,
      opensInH: OPENNESS_DAYS * 24,
      openForH: 0,
    };
  }
  let run = 0;
  for (let i = opensInSlots; i < bits.length && bits[i]; i++) run++;
  return {
    bits,
    unknown: false,
    opensInH: opensInSlots * TIME_BLOCK_H,
    openForH: run * TIME_BLOCK_H,
  };
}


// ── CONTEXT DOCUMENTS — the wide embedding contexts, assembled for real ──
// These are the documents the real pipeline will embed for EM: everything is
// TEXT — hours and zones appear as words; numeric distance/time live only in
// SM, numeric proof only in GP. The field set is FIXED (scores.CONTEXT_FIELDS
// is documentation, not config — v10 retired the per-field toggles): every
// builder always assembles from every live field with data.

/**
 * The consumer half of the CI document — barely-mutable side. Spec fields
 * ONLY: name · sex · age · country · class+why. Taste and history are the
 * spec's "ignored for now" — never embedded.
 */
function buildConsumerDoc(profile: ConsumerProfile): string {
  const c = profile.consumer;
  const igWhy =
    c?.instagram_followers != null && c.instagram_followers > 0 ? "IG-invited" : "subscribed";
  return [
    c?.label ?? "Anonymous consumer",
    c?.sex ?? null,
    c?.age != null ? `${c.age} years old` : null,
    c?.country ?? null,
    `${c?.class_key ?? "standard"} class (${igWhy})`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The full CI document — consumer (stable) + intent (per-query), merged. */
export function buildCiDoc(profile: ConsumerProfile, intent: Intent): string {
  const intentBits = [intent.parts.query, intent.parts.zone, intent.parts.time].filter(Boolean);
  return [
    buildConsumerDoc(profile),
    intentBits.length > 0 ? `Intent: ${intentBits.join(" · ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The place document — what EM embeds. Spec fields ONLY: name · category ·
 * description · zone & city (+ price when present). Tags are ignored
 * (MESITA-720 — too noisy). Rating/hours are ROUTED to GP/SM — numeric,
 * never embedded here. */
export function buildPlaceDoc(p: SamplePlace): string {
  const head = [
    p.name,
    p.category ? `a ${p.category.replace(/_/g, " ")}` : null,
    [p.zone, p.city].filter(Boolean).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" — ");
  const desc = p.description ? p.description : "";
  return [head, desc].filter(Boolean).join("\n");
}

// ── EMULATED EMBEDDINGS — feature-hashed bag-of-tokens ──────────────────
// A deterministic stand-in for the real encoder (OpenAI
// text-embedding-3-small): tokenize the document, hash every token into a
// signed slot of a fixed-dim vector, L2 normalize. Same shape as the real
// thing (document → unit vector → dot product), so EM IS the cosine of two
// generated vectors — just from a toy encoder.

const EMBED_DIMS = 64;

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

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i] * b[i];
  return dot;
}

/** EM from the two vectors — max(0, cos), in [0,1]. */
export function emFromVectors(ciVec: number[], placeVec: number[]): number {
  return Math.max(0, Math.min(1, cosineSim(ciVec, placeVec)));
}
