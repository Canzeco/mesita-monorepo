// The place aggregate — validator + THE write door (MESITA-1279, split from
// MESITA-1247 "Mesita as documents" §C, item 4 of 6 — see that issue's
// 2026-08-23 21:58 comment for the per-aggregate write-surface count this
// issue was scoped from: place is the largest of the three remaining
// aggregates, 29 write call sites across 16 files against THREE surfaces:
//   • place_profiles   — the Google-observed / Enricher-owned profile
//   • places — the owned Mesita entity: slug, state, content state, currency
//   • profiles — a SECURITY INVOKER VIEW joining the two (`p.* JOIN u.*`,
//     see the 20260602-era migrations), NOT a base table. It carries two
//     INSTEAD OF triggers (profiles_insert / profiles_update) that split a
//     view-level write across both base tables inside ONE Postgres
//     statement — so a write ROUTED THROUGH THE VIEW keeps today's
//     cross-table atomicity. This door therefore never re-derives that
//     split itself: `table: "profiles"` forwards the validated patch to
//     `.from("profiles")`, exactly like every existing call site that used
//     the view already does. `table: "place_profiles"` / `table: "places"` write
//     the base table directly, exactly like every existing call site that
//     already targeted one table alone. Nothing about WHICH surface a call
//     site writes through changes here — only that every patch now passes
//     through one validator before Postgres sees it.
//
// THE TWO-BELT PATTERN (StampableCrenupStep, crenup-report.ts; see
// consumer-doc.ts for the fuller writeup):
//   Belt 1 — TypeScript. PlaceWriteArgs.patch is typed PlaceProfilePatch /
//     PlacePatch / ProfilePatch (closed key sets), not
//     Record<string, unknown>.
//   Belt 2 — runtime. validatePlaceProfilePatch / validatePlacePatch /
//     validateProfilePatch re-check the same closed key sets (HTTP JSON has
//     no compiler) plus the shape and range invariants below. A malformed
//     patch never reaches Postgres.
//
// LANDMINES CARRIED IN FROM REPO LAW (MESITA-1279's issue body), enforced
// here rather than rediscovered:
//   • `place_profiles.name` is a GENERATED column (coalesce(mesita_name,
//     google_name)) — Postgres rejects a write to it (428C9) and
//     `_shared/place-name-writes.test.ts` source-scans for one. `name` is
//     simply never a member of PLACE_PROFILE_PATCH_KEYS, so any patch carrying it
//     is rejected by the closed-key-set check below with
//     "unknown place field: name" — belt 2 cannot contradict a guard it was
//     never given the key to violate.
//   • `google_place_id` is the immutable external identity spine once set.
//     The one caller that ever WRITES it is the create path (save-place.ts,
//     mode: "insert"); no update call site in the codebase sets it.
//     writePlace() enforces the rule at the door: `google_place_id` in an
//     UPDATE patch against "place_profiles" or "profiles" is refused before
//     validation even runs.
//   • `profiles` is a view, not a base table — see the header above.
//
// THE INVARIANTS below mirror LIVE Postgres CHECK constraints (pulled via
// `pg_get_constraintdef` against the `place_profiles` / `places` tables, MESITA
// project) and the two tables' native Postgres enum columns (`place_state`,
// `content_state`, pulled via `pg_enum`) — not invented rules. Each group
// below names the constraint it mirrors. One invariant is only PARTIALLY checkable from a
// patch alone (place_profiles_name_source_present, see checkPlaceNameSourceInvariant)
// — Postgres, which sees the whole row, is the final authority there.
//
// Deliberately NOT here: URL shape (`isUrl`), hours structure
// (`sanitiseHours`), tag normalization, phone E.164 shape, category
// resolution. None of those are DB constraints — they are HTTP-input
// business rules admin-web-update-place (and friends) already own and
// validate before a patch ever reaches this door. This validator checks the
// STORED SHAPE Postgres itself would reject, same posture consumer-doc.ts
// took for birthday / avatar_url.

import { withoutTableB } from "./google-table-b.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { nullable } from "./doc-schema.ts";
import { GoogleReviewsSchema, PopularTimesSchema } from "./place-jsonb-schemas.ts";
import { EnrichmentMapSchema } from "./schema-catalog.ts";
// ── PlaceProfileRow — the full `place_profiles` row shape ──────────────────────────────────

/** How a guest reaches the place on Reservations (Pato 2026-08-25). */
export type ServingChannel = "phone" | "whatsapp" | "instagram" | "web" | "none";

export const SERVING_CHANNELS: readonly ServingChannel[] = [
  "phone",
  "whatsapp",
  "instagram",
  "web",
  "none",
];

export function isServingChannel(value: unknown): value is ServingChannel {
  return typeof value === "string" &&
    (SERVING_CHANNELS as readonly string[]).includes(value);
}

export type PlaceProfileRow = {
  id: string;
  created_at: string;
  updated_at: string;
  /** GENERATED ALWAYS AS (coalesce(mesita_name, google_name)). Never a patch key. */
  name: string;
  /** Immutable once set — see the header. Settable only via mode: "insert". */
  google_place_id: string | null;
  category: string | null;
  google_primary_type: string | null;
  google_types: unknown;
  mesita_categories: unknown;
  /** Families (0–1). Create path stamps ['undefined'] until contents infers a classified Category. */
  family_keys: string[] | null;
  price_level: number | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  timezone: string | null;
  closes_at: string | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  photos: string[];
  google_photos: string[];
  mesita_photos: string[];
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  opentable_url: string | null;
  resy_url: string | null;
  uber_eats_url: string | null;
  x_url: string | null;
  threads_url: string | null;
  reddit_url: string | null;
  google_maps_url: string | null;
  didi_food_url: string | null;
  hours: unknown | null;
  /** pgvector literal, e.g. "[0.1,0.2,...]" — always a string on the JS side. */
  embedding: string | null;
  /** MESITA-1238: name-only vector. Same literal shape as `embedding`. */
  name_embedding: string | null;
  description: string | null;
  menu_pdf_url: string | null;
  tags: string[];
  /** Google atmosphere slugs. The Profile tags box. Not the Mesita catalog. */
  google_tags: string[];
  google_stars_overall: number | null;
  google_review_count: number | null;
  instagram_followers_count: number | null;
  menu_pdf_name: string | null;
  enriched_at: string | null;
  enrichment_sources: unknown | null;
  zone: string | null;
  city: string | null;
  facebook_followers: number | null;
  google_reviews: unknown | null;
  /** Google's structured location. Not an LLM rewrite. */
  google_address: unknown | null;
  /** Last sync of volatile review and social fields. */
  source_sync: unknown | null;
  menus: unknown | null;
  popular_times: unknown | null;
  products: unknown | null;
  category_label: string | null;
  embedding_source_text: string | null;
  google_name: string | null;
  mesita_name: string | null;
  /** MESITA-1249: the materialized meter — see EnrichmentMapSchema. */
  enrichment: unknown;
  /** MESITA-2189: the Google place id resolved. Not an enrichment fact. */
  google_found: boolean;
  /** MESITA-2189: a live Instagram profile came back. */
  instagram_found: boolean;
  /** MESITA-2189: a Facebook page came back. */
  facebook_found: boolean;
  reservation_channel: ServingChannel | null;
  reservation_target: string | null;
  business_state: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null;
  business_state_at: string | null;
  /** Description/Actions — LLM: this kind of place likely takes reservations. */
  reservations_enabled: boolean;
  prepay_enabled: boolean;
  payments_enabled: boolean;
};

export const PLACE_PROFILE_PATCH_KEYS = [
  "google_place_id",
  "category",
  "google_primary_type",
  "google_types",
  "mesita_categories",
  "family_keys",
  "price_level",
  "lat",
  "lng",
  "address",
  "timezone",
  "closes_at",
  "phone",
  "pitch",
  "story",
  "photos",
  "google_photos",
  "mesita_photos",
  "website_url",
  "instagram_url",
  "facebook_url",
  "whatsapp_url",
  "opentable_url",
  "resy_url",
  "uber_eats_url",
  "x_url",
  "threads_url",
  "reddit_url",
  "google_maps_url",
  "didi_food_url",
  "hours",
  "embedding",
  "name_embedding",
  "description",
  "menu_pdf_url",
  "tags",
  "google_tags",
  "google_stars_overall",
  "google_review_count",
  "instagram_followers_count",
  "menu_pdf_name",
  "enriched_at",
  "enrichment_sources",
  "zone",
  "city",
  "facebook_followers",
  "google_reviews",
  "menus",
  "popular_times",
  "products",
  "google_address",
  "source_sync",
  "category_label",
  "embedding_source_text",
  "google_name",
  "mesita_name",
  "enrichment",
  "google_found",
  "instagram_found",
  "facebook_found",
  "reservation_channel",
  "reservation_target",
  "business_state",
  "business_state_at",
  "reservations_enabled",
  "prepay_enabled",
  "payments_enabled",
] as const satisfies readonly (keyof Omit<
  PlaceProfileRow,
  "id" | "created_at" | "updated_at" | "name"
>)[];

// Compile-time exhaustiveness the other direction — same discipline
// CONSUMER_PATCH_KEYS uses (borrowed from CRENUP_STEP_META, MESITA-1222): a
// field added to PlaceProfileRow and forgotten here fails the build, not a review.
type _MissingFromPlaceProfilePatchKeys = Exclude<
  keyof Omit<PlaceProfileRow, "id" | "created_at" | "updated_at" | "name">,
  typeof PLACE_PROFILE_PATCH_KEYS[number]
>;
const _assertNoMissingPlaceProfileKeys: _MissingFromPlaceProfilePatchKeys extends never ? true
  : ["PLACE_PROFILE_PATCH_KEYS is missing a field from PlaceProfileRow", _MissingFromPlaceProfilePatchKeys] = true;
void _assertNoMissingPlaceProfileKeys;

export type PlaceProfilePatch = Partial<Pick<PlaceProfileRow, typeof PLACE_PROFILE_PATCH_KEYS[number]>>;

// ── PlaceRow — the full `places` row shape ──────────────────────────────────

export type PlaceRow = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  state: "active" | "paused" | "archived";
  content_state: "generating" | "ready" | "failed";
  currency: string;
  /** Mesita Selected: the operator's own mark (MESITA-2707). Independent of
   *  `enriched_at` and never derived from a score (the Area score multiplies
   *  it by the Selected boost, MESITA-2717); admin-web-set-place-selected
   *  is the only writer. */
  selected: boolean;
};

export const PLACE_PATCH_KEYS = [
  "slug",
  "state",
  "content_state",
  "currency",
  "selected",
] as const satisfies readonly (keyof Omit<PlaceRow, "id" | "created_at" | "updated_at">)[];

type _MissingFromPlacePatchKeys = Exclude<
  keyof Omit<PlaceRow, "id" | "created_at" | "updated_at">,
  typeof PLACE_PATCH_KEYS[number]
>;
const _assertNoMissingPlaceKeys: _MissingFromPlacePatchKeys extends never ? true
  : ["PLACE_PATCH_KEYS is missing a field from PlaceRow", _MissingFromPlacePatchKeys] = true;
void _assertNoMissingPlaceKeys;

export type PlacePatch = Partial<Pick<PlaceRow, typeof PLACE_PATCH_KEYS[number]>>;

/** The `profiles` view's writable surface — both tables' patch keys at once. */
export type ProfilePatch = PlaceProfilePatch & PlacePatch;

// ── shape primitives ─────────────────────────────────────────────────────

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}
function isNullableNumber(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}
function isNullableRange(v: unknown, min: number, max: number): boolean {
  return v === null || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);
}
function isNullableNonNegInt(v: unknown): boolean {
  return v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0);
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
/** jsonb columns: STORED SHAPE only — an object, an array, or null. */
function isJsonish(v: unknown): boolean {
  return v === null || (typeof v === "object");
}
function isNonNullEnum<T extends string>(v: unknown, legal: ReadonlySet<T>): v is T {
  return typeof v === "string" && legal.has(v as T);
}

// ── place_profiles_* field groups (mirrors the live CHECK constraints named) ───────

const PLACE_PLAIN_STRING_KEYS = new Set<string>([
  "category", "address", "timezone", "closes_at", "phone", "pitch",
  "story", "website_url", "instagram_url", "facebook_url",
  "whatsapp_url", "opentable_url", "resy_url", "uber_eats_url", "x_url",
  "threads_url", "reddit_url", "google_maps_url",
  "didi_food_url", "description",
  "menu_pdf_url", "menu_pdf_name",
  "zone", "city", "category_label",
  "embedding_source_text", "google_name", "mesita_name", "google_primary_type",
  "reservation_target", "embedding", "name_embedding",
  "google_place_id",
  "enriched_at", "business_state_at",
]);
const PLACE_UNRANGED_NUMBER_KEYS = new Set<string>(["lat", "lng"]);
// place_profiles_google_stars_overall_check — 0..5 inclusive, null allowed.
const PLACE_STAR_RATING_KEYS = new Set<string>(["google_stars_overall"]);
// place_profiles_google_review_count_check / place_profiles_instagram_followers_count_check
// / place_profiles_facebook_followers_check — >= 0, null allowed (a raw `col >= 0`
// CHECK still passes NULL under Postgres 3-valued logic).
const PLACE_NONNEG_INT_KEYS = new Set<string>([
  "google_review_count", "instagram_followers_count", "facebook_followers",
]);
// hours/enrichment_sources/menus/products stay opaque (isJsonish) — no
// schema exists for their internal shape yet. google_reviews/popular_times
// moved OUT of this set (MESITA-1247 reconciliation, see
// PLACE_SCHEMA_JSON_KEYS below): place-jsonb-schemas.ts already validates
// their content, and PR #1163 first shipped that validation only at two
// caller-side gates (enrich-synthesis-profile.ts, enrich-google-basics.ts)
// plus a competing, uncalled `update-place.ts` door — folding the same
// schemas in HERE, at the one real door, closes the gap for every OTHER
// caller these fields would otherwise pass through unvalidated (this
// door's own PLACE/PROFILE surfaces, save-place.ts's create insert, and
// any future writer), not just the two hand-patched call sites.
const PLACE_JSON_KEYS = new Set<string>([
  "hours", "enrichment_sources", "menus", "products", "google_address", "source_sync",
  "google_types", "mesita_categories",
]);
// Content-validated JSONB keys — nullable() wraps each schema because the
// column itself is nullable and a patch clearing it to null must stay legal
// (place-jsonb-schemas.ts's own schemas reject bare `null`, by design, since
// they are also used where absence already means "don't touch this field").
const PLACE_SCHEMA_JSON_KEYS: Record<string, { parse(v: unknown): { ok: boolean; error?: string } }> = {
  google_reviews: nullable(GoogleReviewsSchema),
  popular_times: nullable(PopularTimesSchema),
  // NOT nullable — place_profiles.enrichment is NOT NULL with a default (MESITA-1249).
  enrichment: EnrichmentMapSchema,
};
const PLACE_STRING_ARRAY_KEYS = new Set<string>([
  "photos",
  "google_photos",
  "mesita_photos",
  "tags",
  "google_tags",
]);
// NOT NULL boolean column, default true (MESITA-1799). It joined
// PLACE_PROFILE_PATCH_KEYS in #1395 but never got a checkPlaceProfileField
// branch — every patch carrying it fell through to "unknown place field" and
// the WHOLE patch was rejected (latent until the 2026-08-29 EF redeploy sweep
// put the door in front of the live contents publish; caught and fixed the
// same day).
const PLACE_PROFILE_BOOLEAN_KEYS = new Set<string>([
  "reservations_enabled",
  "prepay_enabled",
  "payments_enabled",
  "google_found",
  "instagram_found",
  "facebook_found",
]);
const BUSINESS_STATE_VALUES = new Set(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);

function checkPlaceProfileField(key: string, v: unknown): string | null {
  if (PLACE_PROFILE_BOOLEAN_KEYS.has(key)) {
    return isBoolean(v) ? null : `${key} must be a boolean`;
  }
  if (PLACE_PLAIN_STRING_KEYS.has(key)) {
    return isNullableString(v) ? null : `${key} must be a string or null`;
  }
  if (PLACE_UNRANGED_NUMBER_KEYS.has(key)) {
    return isNullableNumber(v) ? null : `${key} must be a number or null`;
  }
  if (PLACE_STAR_RATING_KEYS.has(key)) {
    return isNullableRange(v, 0, 5) ? null : `${key} must be between 0 and 5, or null`;
  }
  if (PLACE_NONNEG_INT_KEYS.has(key)) {
    return isNullableNonNegInt(v) ? null : `${key} must be a non-negative integer, or null`;
  }
  if (key in PLACE_SCHEMA_JSON_KEYS) {
    const r = PLACE_SCHEMA_JSON_KEYS[key].parse(v);
    return r.ok ? null : `${key}: ${r.error}`;
  }
  if (PLACE_JSON_KEYS.has(key)) {
    return isJsonish(v) ? null : `${key} must be an object, an array, or null`;
  }
  if (PLACE_STRING_ARRAY_KEYS.has(key)) {
    return isStringArray(v) ? null : `${key} must be an array of strings`;
  }
  if (key === "family_keys") {
    return v === null || isStringArray(v)
      ? null
      : "family_keys must be an array of strings or null";
  }
  switch (key) {
    // place_profiles_price_level_check
    case "price_level":
      return isNullableRange(v, 1, 4) ? null : "price_level must be between 1 and 4, or null";
    // place_profiles_business_state_check
    case "business_state":
      return v === null || (typeof v === "string" && BUSINESS_STATE_VALUES.has(v)) ? null
        : "business_state must be OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY, or null";
    // place_profiles_reservation_channel_check
    case "reservation_channel":
      return v === null || isServingChannel(v) ? null
        : `${key} must be phone, whatsapp, instagram, web, none, or null`;
    default:
      return `unknown place field: ${key}`;
  }
}

/**
 * place_profiles_name_source_present: COALESCE(NULLIF(btrim(mesita_name),''),
 * NULLIF(btrim(google_name),'')) IS NOT NULL. A PARTIAL mirror — Postgres
 * checks the whole row, but this door only ever sees one patch. The one case
 * fully knowable from a patch alone: both fields present in the SAME patch,
 * both empty. Anything involving the row's CURRENT value is Postgres's call.
 */
function checkPlaceNameSourceInvariant(patch: Record<string, unknown>): string | null {
  if (!("mesita_name" in patch) || !("google_name" in patch)) return null;
  const m = typeof patch.mesita_name === "string" ? patch.mesita_name.trim() : "";
  const g = typeof patch.google_name === "string" ? patch.google_name.trim() : "";
  if (!m && !g) {
    return "mesita_name and google_name cannot both be empty in the same patch " +
      "(place_profiles_name_source_present — place_profiles.name would have nothing to generate from)";
  }
  return null;
}

export type PlaceProfilePatchValidation =
  | { ok: true; patch: PlaceProfilePatch }
  | { ok: false; error: string };

export function validatePlaceProfilePatch(input: unknown): PlaceProfilePatchValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "place patch must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!(PLACE_PROFILE_PATCH_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown place field: ${key}` };
    }
    const err = checkPlaceProfileField(key, raw[key]);
    if (err) return { ok: false, error: err };
    patch[key] = key === "google_types" ? withoutTableB(raw[key]) : raw[key];
  }
  const nameErr = checkPlaceNameSourceInvariant(patch);
  if (nameErr) return { ok: false, error: nameErr };
  return { ok: true, patch: patch as PlaceProfilePatch };
}

// ── places_* field groups (mirrors the live CHECK constraints named) ───────

const PLACE_NOTNULL_STRING_KEYS = new Set<string>(["slug", "currency"]);

// The live enums still carry lead / pending_review / pending_verification and
// queued until the profiles-view migration drops them; no writer sends one, so
// the door refuses them now (MESITA-2144).
const STATE_VALUES = new Set(["active", "paused", "archived"]);
const CONTENT_STATE_VALUES = new Set(["generating", "ready", "failed"]);

function checkPlaceField(key: string, v: unknown): string | null {
  if (PLACE_NOTNULL_STRING_KEYS.has(key)) {
    return isNonEmptyString(v) ? null : `${key} must be a non-empty string`;
  }
  switch (key) {
    // Postgres enum columns — NOT NULL at the type level.
    case "state":
      return isNonNullEnum(v, STATE_VALUES) ? null
        : `state must be one of ${[...STATE_VALUES].join(", ")}`;
    case "content_state":
      return isNonNullEnum(v, CONTENT_STATE_VALUES) ? null
        : `content_state must be one of ${[...CONTENT_STATE_VALUES].join(", ")}`;
    default:
      return `unknown place-row field: ${key}`;
  }
}

export type PlacePatchValidation =
  | { ok: true; patch: PlacePatch }
  | { ok: false; error: string };

export function validatePlacePatch(input: unknown): PlacePatchValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "place-row patch must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!(PLACE_PATCH_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown place-row field: ${key}` };
    }
    const err = checkPlaceField(key, raw[key]);
    if (err) return { ok: false, error: err };
    patch[key] = raw[key];
  }
  return { ok: true, patch: patch as PlacePatch };
}

export type ProfilePatchValidation =
  | { ok: true; patch: ProfilePatch }
  | { ok: false; error: string };

/**
 * Validates a patch against the `profiles` view's combined writable surface
 * — place_profiles fields and places fields in the SAME patch, exactly what every
 * existing caller writing through that view already sends (the view's
 * INSTEAD OF trigger splits it across both tables in one statement; see the
 * file header). PLACE_PROFILE_PATCH_KEYS and PLACE_PATCH_KEYS are disjoint —
 * checked directly by
 * "place-doc.test.ts: PLACE_PROFILE_PATCH_KEYS and PLACE_PATCH_KEYS never collide".
 */
export function validateProfilePatch(input: unknown): ProfilePatchValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "profile patch must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    const isPlaceProfileKey = (PLACE_PROFILE_PATCH_KEYS as readonly string[]).includes(key);
    const isPlaceRowKey = (PLACE_PATCH_KEYS as readonly string[]).includes(key);
    if (!isPlaceProfileKey && !isPlaceRowKey) {
      return { ok: false, error: `unknown profile field: ${key}` };
    }
    const err = isPlaceProfileKey ? checkPlaceProfileField(key, raw[key]) : checkPlaceField(key, raw[key]);
    if (err) return { ok: false, error: err };
    patch[key] = key === "google_types" ? withoutTableB(raw[key]) : raw[key];
  }
  const nameErr = checkPlaceNameSourceInvariant(patch);
  if (nameErr) return { ok: false, error: nameErr };
  return { ok: true, patch: patch as ProfilePatch };
}

// ── writePlace — THE write door ─────────────────────────────────────────────

export type PlaceWriteResult =
  | { ok: true; row: Record<string, unknown> | null }
  | { ok: false; error: string; code?: string };

type SelectMode = "single" | "maybeSingle";

export type PlaceWriteArgs =
  | { table: "place_profiles"; mode: "insert"; patch: PlaceProfilePatch; select?: string; selectMode?: SelectMode }
  | {
    table: "place_profiles";
    mode: "update";
    id: string;
    patch: PlaceProfilePatch;
    select?: string;
    selectMode?: SelectMode;
  }
  | { table: "place_profiles"; mode: "delete"; id: string }
  | {
    table: "places";
    mode: "insert";
    id: string;
    patch: PlacePatch;
    select?: string;
    selectMode?: SelectMode;
  }
  | {
    table: "places";
    mode: "update";
    id: string;
    patch: PlacePatch;
    select?: string;
    selectMode?: SelectMode;
    /** Match only a row still in this content_state. A row that already left it is not written. */
    onlyWhile?: "generating";
    /** Match only a row NOT in this content_state: a claim that loses to a run already in flight. */
    unlessWhile?: "generating";
  }
  | {
    table: "profiles";
    mode: "update";
    id: string;
    patch: ProfilePatch;
    select?: string;
    selectMode?: SelectMode;
  };

/**
 * THE place aggregate's write door. Every insert/update/delete against
 * public.place_profiles, public.places, or the public.profiles view in the
 * codebase goes through this — it is the only place a patch is checked
 * against the aggregate's shape, closed key set, and cross-field invariants
 * before Postgres ever sees it. `select`, when given, re-reads exactly those
 * columns after the write (matching what each call site already needed);
 * omitted, the write is fire-and-check-error, same as most existing sites.
 * `selectMode: "maybeSingle"` matches a call site that treats "no row" as a
 * clean 404 rather than a Postgres error (several admin/business EFs do).
 */
export async function writePlace(
  admin: SupabaseClient,
  args: PlaceWriteArgs,
): Promise<PlaceWriteResult> {
  if (args.mode === "delete") {
    const { error } = await admin.from(args.table).delete().eq("id", args.id);
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: null };
  }

  // google_place_id is the immutable identity spine once set (see header) —
  // only mode: "insert" may write it.
  if (
    args.mode === "update" && (args.table === "place_profiles" || args.table === "profiles") &&
    "google_place_id" in (args.patch as Record<string, unknown>)
  ) {
    return {
      ok: false,
      error: "google_place_id is immutable once set — only the create path may write it",
    };
  }

  const validated = args.table === "place_profiles"
    ? validatePlaceProfilePatch(args.patch)
    : args.table === "places"
    ? validatePlacePatch(args.patch)
    : validateProfilePatch(args.patch);
  if (!validated.ok) return { ok: false, error: validated.error };

  const selectMode = args.selectMode ?? "single";

  if (args.mode === "insert") {
    const row: Record<string, unknown> = args.table === "places"
      ? { id: args.id, ...validated.patch }
      : { ...validated.patch };
    const builder = admin.from(args.table).insert(row);
    if (args.select) {
      const withSelect = builder.select(args.select);
      const { data, error } = selectMode === "maybeSingle"
        ? await withSelect.maybeSingle()
        : await withSelect.single();
      if (error) return { ok: false, error: error.message, code: error.code };
      return { ok: true, row: data as Record<string, unknown> | null };
    }
    const { error } = await builder;
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: null };
  }

  // mode === "update"
  let updateBuilder = admin.from(args.table).update(validated.patch).eq("id", args.id);
  if ("onlyWhile" in args && args.onlyWhile) {
    updateBuilder = updateBuilder.eq("content_state", args.onlyWhile);
  }
  if ("unlessWhile" in args && args.unlessWhile) {
    updateBuilder = updateBuilder.neq("content_state", args.unlessWhile);
  }
  if (args.select) {
    const withSelect = updateBuilder.select(args.select);
    const { data, error } = selectMode === "maybeSingle"
      ? await withSelect.maybeSingle()
      : await withSelect.single();
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: data as Record<string, unknown> | null };
  }
  const { error } = await updateBuilder;
  if (error) return { ok: false, error: error.message, code: error.code };
  return { ok: true, row: null };
}
