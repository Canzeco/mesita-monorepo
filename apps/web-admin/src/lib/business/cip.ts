// CIP — Consumer · Intent · Place. The playground's data plumbing for the
// scoring draft: build the consumer side, synthesize intents, and estimate
// RIPM/LIPM until real embeddings and a judge EF exist.
//
// THREE DATA OBJECTS, TWO SIDES. Consumer-data and intent-data are the SAME
// side of the match (the query side) — merged before matching. The difference
// is mutability: consumer-data barely moves (taste, class), intent-data is
// per-query (tonight, near X, with friends). Place-data is the other side.
//
//   RM-CIP  RAG match over (consumer + intent) × place — real consumer,
//           synthetic intent, real place.
//   LM-CIP  LLM-judge match over the same triple.
//   WW      computed from (intent × place): haversine distance + the place's
//           real hours vs the intent's synthetic query time.
//   P       from the real place — posture derived from its live promo rates.
//
// HONESTY RULES. Consumers and places come from the DB (via
// admin-web-get-scoring-sample) — never invented here. Intent is synthetic BY
// DESIGN (that's what an intent generator is). Consumer taste uses real
// saves/visits when they exist; an empty history gets a deterministic
// synthetic taste and is LABELED synthetic. RM/LM here are deterministic
// token-overlap heuristics — stand-ins for pgvector cosine and the LLM judge,
// which do not exist yet; the numbers are for exercising the model's shape,
// not for believing.

import type { EngineId } from "./scores";

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
  engine: EngineId;
  /** The rendered prompt. Fixed structure for swipe/map; flexible for memo. */
  text: string;
  /** The mutable query-side tokens (merged with taste for matching). */
  tokens: string[];
  lat: number | null;
  lng: number | null;
  day: string;
  hour: number;
  timeLabel: string;
};

const DAYS = ["wednesday", "friday", "saturday", "sunday"] as const;
const HOURS = [13, 18.5, 20.5, 22.5] as const;

// Memo's flexible bank — occasion templates with their own tokens and their
// own natural time. Swipe/Map never touch these: their prompt structure is
// fixed and only the data changes.
const MEMO_BANK = [
  { text: "Where do I take a first date tonight?", tokens: ["date_night", "romantic", "cocktail_bar", "wine_bar", "upscale"], hour: 20.5, day: "friday" },
  { text: "Best brunch for Sunday with my parents?", tokens: ["brunch", "casual", "family", "specialty_coffee"], hour: 11, day: "sunday" },
  { text: "Where can we dance until late on Saturday?", tokens: ["night_club", "live_music", "trendy", "dance"], hour: 23, day: "saturday" },
  { text: "Quiet spot to work over coffee this afternoon?", tokens: ["specialty_coffee", "quiet", "casual", "work"], hour: 16, day: "wednesday" },
  { text: "Big group birthday dinner — where?", tokens: ["fine_dining", "groups", "celebrations", "lively"], hour: 21, day: "saturday" },
  { text: "Rooftop drinks with a view before dinner?", tokens: ["rooftop", "terrace", "cocktail_bar", "city_view"], hour: 19, day: "friday" },
] as const;

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Anchor the synthetic user near a real place: same city, walkable jitter. */
function anchor(places: SamplePlace[], seed: number): { lat: number | null; lng: number | null; near: string } {
  const geo = places.filter((p) => p.lat != null && p.lng != null);
  if (geo.length === 0) return { lat: null, lng: null, near: "unknown" };
  const p = geo[seed % geo.length];
  const jitter = ((seed % 17) - 8) / 8; // −1..1
  return {
    lat: Number(p.lat) + jitter * 0.012, // ≈ ±1.3 km
    lng: Number(p.lng) + jitter * 0.01,
    near: p.zone ?? p.city ?? p.name,
  };
}

export function generateIntent(
  engine: EngineId,
  profile: ConsumerProfile,
  places: SamplePlace[],
  seed: number,
): Intent {
  const a = anchor(places, seed);
  if (engine === "memo") {
    const t = MEMO_BANK[seed % MEMO_BANK.length];
    return {
      engine,
      text: t.text,
      tokens: [...t.tokens].map(norm),
      lat: a.lat,
      lng: a.lng,
      day: t.day,
      hour: t.hour,
      timeLabel: `${t.day} ${fmtHour(t.hour)}`,
    };
  }
  // Swipe/Map — FIXED prompt structure; only the data slots change.
  const day = DAYS[seed % DAYS.length];
  const hour = HOURS[seed % HOURS.length];
  const party = [2, 2, 4, 6][seed % 4];
  const daypart = hour < 15 ? "lunch" : hour < 20 ? "evening" : "night";
  const taste = profile.tasteTokens.slice(0, 4);
  const base = {
    engine,
    tokens: [daypart, ...taste].map(norm),
    lat: a.lat,
    lng: a.lng,
    day,
    hour,
    timeLabel: `${day} ${fmtHour(hour)}`,
  };
  if (engine === "map") {
    return { ...base, text: `map · viewport ≈2 km around ${a.near} · ${day} ${fmtHour(hour)} · party of ${party} · taste: ${taste.join(", ")}` };
  }
  return { ...base, text: `swipe · near ${a.near} · ${day} ${fmtHour(hour)} · party of ${party} · taste: ${taste.join(", ")}` };
}

// ── Match heuristics (RM/LM stand-ins) ──────────────────────────────────

export function placeTokens(p: SamplePlace): string[] {
  return [
    ...(p.category ? [p.category] : []),
    ...(Array.isArray(p.tags) ? p.tags : []),
    ...(p.zone ? [p.zone] : []),
    ...(p.city ? [p.city] : []),
  ].map(norm);
}

/** RM-CIP — set-cosine token overlap of (taste + intent) × place → 0–100. */
export function rmCip(ciTokens: string[], place: SamplePlace): number {
  const a = new Set(ciTokens);
  const b = new Set(placeTokens(place));
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return Math.round((inter / Math.sqrt(a.size * b.size)) * 100);
}

// Occasion×category clashes an LLM judge would catch but token overlap won't.
const CLASH: Record<string, string[]> = {
  date_night: ["sports_bar", "fast_food"],
  romantic: ["sports_bar", "night_club"],
  work: ["night_club", "live_music"],
  quiet: ["night_club", "sports_bar", "live_music"],
  family: ["night_club", "speakeasy"],
  brunch: ["night_club"],
};

/** LM-CIP — RM plus the structured judgments a judge adds. Deterministic.
 * Pass `rmBase` to build on the vector-cosine RM instead of token overlap. */
export function lmCip(
  ciTokens: string[],
  place: SamplePlace,
  consumerId: string,
  rmBase?: number,
): number {
  let v = rmBase ?? rmCip(ciTokens, place);
  const ci = new Set(ciTokens);
  const cat = place.category ? norm(place.category) : null;
  if (cat && ci.has(cat)) v += 15;
  if (place.zone && ci.has(norm(place.zone))) v += 8;
  if (cat) {
    for (const t of ci) if (CLASH[t]?.includes(cat)) { v -= 18; break; }
  }
  // Judgment nuance — stable per consumer×place pair, never random.
  v += (hash(consumerId + place.id) % 13) - 6;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ── WW inputs from real geo + real hours ────────────────────────────────

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
 * The place's real hours vs the intent's query time → WW's when-inputs.
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

// ── WHAT — daypart suitability of a category ────────────────────────────
// The temporal half of "what": is this hour the category's natural daypart?
// (Match handles the SEMANTIC what.) Keyword windows, hours may wrap past
// midnight. Unknown categories fit every hour — no penalty on ignorance.

const WHAT_WINDOWS: { re: RegExp; start: number; end: number }[] = [
  { re: /club|antro|night_club|karaoke/, start: 21, end: 28 }, // 21:00–04:00
  { re: /bar|cantina|pub|speakeasy|wine|cocktail|brewer/, start: 17, end: 26 }, // 17:00–02:00
  { re: /brunch|breakfast|cafe|coffee|bakery|desayun|juice/, start: 7, end: 17 },
];

/** True when `hour` falls in the category's natural daypart (or none is known). */
export function whatFits(category: string | null, hour: number): boolean {
  if (!category) return true;
  const w = WHAT_WINDOWS.find((x) => x.re.test(category.toLowerCase()));
  if (!w) return true;
  const h = ((hour % 24) + 24) % 24;
  if (w.end <= 24) return h >= w.start && h < w.end;
  // Wrapping window (e.g. 21–28 = 21:00–04:00).
  return h >= w.start || h < w.end - 24;
}

// ── CONTEXT DOCUMENTS — the wide RAG/LLM contexts, assembled for real ───
// These are the documents the real pipeline will embed (RIPM) and hand to
// the judge (LIPM), per the PIPELINE_CONTEXT contract: everything is TEXT —
// hours and zones appear as words; numeric distance/time live only in WWW.

export function hoursToText(hours: SamplePlace["hours"]): string {
  if (!hours || typeof hours !== "object") return "hours unknown";
  const parts = Object.entries(hours)
    .filter(([, v]) => Array.isArray(v) && v.length > 0)
    .map(([day, v]) => `${day} ${v.map((r) => `${r.open}–${r.close}`).join(", ")}`);
  return parts.length > 0 ? parts.join(" · ") : "hours unknown";
}

/** The consumer half of the CI document — barely-mutable side. */
export function buildConsumerDoc(profile: ConsumerProfile): string {
  const c = profile.consumer;
  const who = [
    c?.label ?? "Anonymous consumer",
    c?.sex ?? null,
    c?.age != null ? `${c.age} years old` : null,
    c?.country ?? null,
    `${c?.class_key ?? "free"} class`,
    c?.instagram_followers != null ? `${c.instagram_followers} IG followers` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const taste = `Taste: ${profile.tasteTokens.join(", ")}${profile.synthetic ? " (synthesized — no history yet)" : ""}`;
  const history = c
    ? `History: ${c.saved_taste.length > 0 ? `saves around ${c.saved_taste.slice(0, 6).join(", ")}` : "no saves"}; ${c.visited_taste.length > 0 ? `visits around ${c.visited_taste.slice(0, 6).join(", ")}` : "no paid visits"}.`
    : "History: none.";
  return `${who}\n${taste}\n${history}`;
}

/** The full CI document — consumer (stable) + intent (per-query), merged. */
export function buildCiDoc(profile: ConsumerProfile, intent: Intent): string {
  return `${buildConsumerDoc(profile)}\nIntent: ${intent.text}`;
}

/** The place document — what the Enricher's profile embeds / the judge reads. */
export function buildPlaceDoc(p: SamplePlace): string {
  const head = [
    p.name,
    p.category ? `a ${p.category.replace(/_/g, " ")}` : null,
    [p.zone, p.city].filter(Boolean).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" — ");
  const tags = Array.isArray(p.tags) && p.tags.length > 0 ? `Tags: ${p.tags.join(", ")}.` : "";
  const desc = p.description ? p.description : "";
  const proof =
    p.google_stars_overall != null
      ? `Rated ${p.google_stars_overall}★ across ${p.google_review_count ?? 0} Google reviews.`
      : "";
  const hours = `Hours: ${hoursToText(p.hours)}.`;
  return [head, tags, desc, proof, hours].filter(Boolean).join("\n");
}

// ── EMULATED EMBEDDINGS — feature-hashed bag-of-tokens ──────────────────
// A deterministic stand-in for the real embedding model: tokenize the
// document, hash every token into a signed slot of a fixed-dim vector, L2
// normalize. Same shape as the real thing (document → vector → cosine), so
// RM-CIP IS the cosine of two generated vectors — just from a toy encoder.

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

/** RM-CIP from the two vectors — negative cosine floors at 0. */
export function rmFromVectors(ciVec: number[], placeVec: number[]): number {
  return Math.round(Math.max(0, cosineSim(ciVec, placeVec)) * 100);
}
