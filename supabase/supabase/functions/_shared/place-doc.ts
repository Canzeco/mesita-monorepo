// The place aggregate — validator + THE write door (MESITA-1279, split from
// MESITA-1247 "Mesita as documents" §C, item 4 of 6 — see that issue's
// 2026-08-23 21:58 comment for the per-aggregate write-surface count this
// issue was scoped from: place is the largest of the three remaining
// aggregates, 29 write call sites across 16 files against THREE surfaces:
//   • places   — the Google-observed / Intaker-owned profile
//   • projects — the owned Mesita entity: status, billing, membership
//   • profiles — a SECURITY INVOKER VIEW joining the two (`p.* JOIN u.*`,
//     see the 20260602-era migrations), NOT a base table. It carries two
//     INSTEAD OF triggers (profiles_insert / profiles_update) that split a
//     view-level write across both base tables inside ONE Postgres
//     statement — so a write ROUTED THROUGH THE VIEW keeps today's
//     cross-table atomicity. This door therefore never re-derives that
//     split itself: `table: "profiles"` forwards the validated patch to
//     `.from("profiles")`, exactly like every existing call site that used
//     the view already does. `table: "places"` / `table: "projects"` write
//     the base table directly, exactly like every existing call site that
//     already targeted one table alone. Nothing about WHICH surface a call
//     site writes through changes here — only that every patch now passes
//     through one validator before Postgres sees it.
//
// THE TWO-BELT PATTERN (StampablePulseStep, pulse-report.ts; see
// consumer-doc.ts for the fuller writeup):
//   Belt 1 — TypeScript. PlaceWriteArgs.patch is typed PlacePatch /
//     ProjectPatch / ProfilePatch (closed key sets), not
//     Record<string, unknown>.
//   Belt 2 — runtime. validatePlacePatch / validateProjectPatch /
//     validateProfilePatch re-check the same closed key sets (HTTP JSON has
//     no compiler) plus the shape and range invariants below. A malformed
//     patch never reaches Postgres.
//
// LANDMINES CARRIED IN FROM REPO LAW (MESITA-1279's issue body), enforced
// here rather than rediscovered:
//   • `places.name` is a GENERATED column (coalesce(mesita_name,
//     google_name)) — Postgres rejects a write to it (428C9) and
//     `_shared/place-name-writes.test.ts` source-scans for one. `name` is
//     simply never a member of PLACE_PATCH_KEYS, so any patch carrying it
//     is rejected by the closed-key-set check below with
//     "unknown place field: name" — belt 2 cannot contradict a guard it was
//     never given the key to violate.
//   • `google_place_id` is the immutable external identity spine once set.
//     The one caller that ever WRITES it is the create path (save-place.ts,
//     mode: "insert"); no update call site in the codebase sets it — one
//     (business-web-update-project) explicitly REJECTS a client that tries,
//     upstream of this file. writePlace() enforces the same rule at the
//     door: `google_place_id` in an UPDATE patch against "places" or
//     "profiles" is refused before validation even runs.
//   • `profiles` is a view, not a base table — see the header above.
//
// THE INVARIANTS below mirror LIVE Postgres CHECK constraints (pulled via
// `pg_get_constraintdef` against the `places` / `projects` tables, MESITA
// project) and the two tables' native Postgres enum columns (`project_
// status`, `listing_type`, `plan`, `project_fiscal_type`, `content_status`,
// pulled via `pg_enum`) — not invented rules. Each group below names the
// constraint it mirrors. One invariant is only PARTIALLY checkable from a
// patch alone (places_name_source_present, see checkPlaceNameSourceInvariant)
// — Postgres, which sees the whole row, is the final authority there.
//
// Deliberately NOT here: URL shape (`isUrl`), hours structure
// (`sanitiseHours`), tag normalization, phone E.164 shape, category
// resolution, promo-rate/listing-type derivation. None of those are DB
// constraints — they are HTTP-input business rules business-web-
// update-project (and friends) already own and validate before a patch
// ever reaches this door. This validator checks the STORED SHAPE Postgres
// itself would reject, same posture consumer-doc.ts took for birthday /
// avatar_url.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { nullable } from "./doc-schema.ts";
import {
  GoogleReviewsSchema,
  PlaceDetailsSchema,
  PopularTimesSchema,
} from "./place-jsonb-schemas.ts";
import { EnrichmentMapSchema } from "./schema-catalog.ts";

// ── PlaceRow — the full `places` row shape ──────────────────────────────────

/** How a guest reaches the place on Reservations or Orders (Pato 2026-08-25). */
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

export type PlaceRow = {
  id: string;
  created_at: string;
  updated_at: string;
  /** GENERATED ALWAYS AS (coalesce(mesita_name, google_name)). Never a patch key. */
  name: string;
  /** Immutable once set — see the header. Settable only via mode: "insert". */
  google_place_id: string | null;
  category: string | null;
  /** Super Categories (0–1). Create path stamps ['undefined'] until contents infers a classified Category. */
  family_keys: string[] | null;
  vibe: string | null;
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
  email: string | null;
  hours: unknown | null;
  /** pgvector literal, e.g. "[0.1,0.2,...]" — always a string on the JS side. */
  embedding: string | null;
  embedding_source_hash: string | null;
  /** MESITA-1238: name-only vector. Same literal shape as `embedding`. */
  name_embedding: string | null;
  name_embedding_hash: string | null;
  country: string | null;
  description: string | null;
  menu_pdf_url: string | null;
  tags: string[];
  whatsapp_pr_urls: string[];
  instagram_pr_urls: string[];
  google_business_url: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  google_visitor_count: number | null;
  mesita_stars_overall: number | null;
  mesita_stars_food: number | null;
  mesita_stars_service: number | null;
  mesita_stars_ambience: number | null;
  mesita_review_count: number | null;
  mesita_visitor_count: number | null;
  instagram_followers_count: number | null;
  menu_pdf_name: string | null;
  enriched_at: string | null;
  enrichment_sources: unknown | null;
  editorial_summary: string | null;
  zone: string | null;
  city: string | null;
  established_year: number | null;
  executive_chef: string | null;
  facebook_rating: number | null;
  facebook_followers: number | null;
  mesita_stars_value: number | null;
  details: unknown | null;
  google_reviews: unknown | null;
  menus: unknown | null;
  popular_times: unknown | null;
  products: unknown | null;
  category_label: string | null;
  embedding_source_text: string | null;
  google_name: string | null;
  description_es: string | null;
  mesita_name: string | null;
  enrich_every_days: number | null;
  enrich_mode: "full" | "analysis" | "contents";
  enrich_next_at: string | null;
  /** MESITA-1249: the materialized meter — see EnrichmentMapSchema. */
  enrichment: unknown;
  reservation_channel: ServingChannel | null;
  reservation_target: string | null;
  order_channel: ServingChannel | null;
  order_target: string | null;
  business_status: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null;
  business_status_at: string | null;
  /** Description/Actions — guest Order CTA when menu/catalog exists. */
  orders_enabled: boolean;
  /** Description/Actions — LLM: this kind of place likely takes reservations. */
  reservations_enabled: boolean;
  /** Settlement acceptance INTENT BIT (Pato gates 2026-08-29): the operator's
   *  "this place accepts Mesita Pay" toggle (admin-web-set-place-rails, the
   *  Partner tab). The future gateway engine ANDs this with the global
   *  visits_config.payCard switch and Stripe capability — never a cache of
   *  engine state. PLACES-ONLY (see PLACE_INTENT_BIT_KEYS): the
   *  profiles_update trigger enumerates its SET list and silently drops
   *  columns it predates, so the profiles door refuses these instead of
   *  no-opping them. */
  mesita_pay_enabled: boolean;
  /** Same contract for Mesita Credits: cleared to accept Credits when they
   *  land. Engine ANDs with visits_config.payCredits; Credits settle as a
   *  bill REDUCTION, never a payment method (🧾 Checkout §B / 🪙 Credits). */
  credits_enabled: boolean;
  /** Order-rail acceptance INTENT BITS (Pato gate 2026-08-29, Promotion
   *  score): the operator's pickup / delivery offering toggles. Distinct from
   *  content-derived `orders_enabled` (the guest Order CTA, menu-driven) —
   *  these say what the place WANTS to offer once the order rail ships. Same
   *  places-only write rule as the settlement bits above. */
  pickup_orders_enabled: boolean;
  delivery_orders_enabled: boolean;
};

export const PLACE_PATCH_KEYS = [
  "google_place_id",
  "category",
  "family_keys",
  "vibe",
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
  "email",
  "hours",
  "embedding",
  "embedding_source_hash",
  "name_embedding",
  "name_embedding_hash",
  "country",
  "description",
  "menu_pdf_url",
  "tags",
  "whatsapp_pr_urls",
  "instagram_pr_urls",
  "google_business_url",
  "google_stars_overall",
  "google_review_count",
  "google_visitor_count",
  "mesita_stars_overall",
  "mesita_stars_food",
  "mesita_stars_service",
  "mesita_stars_ambience",
  "mesita_review_count",
  "mesita_visitor_count",
  "instagram_followers_count",
  "menu_pdf_name",
  "enriched_at",
  "enrichment_sources",
  "editorial_summary",
  "zone",
  "city",
  "established_year",
  "executive_chef",
  "facebook_rating",
  "facebook_followers",
  "mesita_stars_value",
  "details",
  "google_reviews",
  "menus",
  "popular_times",
  "products",
  "category_label",
  "embedding_source_text",
  "google_name",
  "description_es",
  "mesita_name",
  "enrich_every_days",
  "enrich_mode",
  "enrich_next_at",
  "enrichment",
  "reservation_channel",
  "reservation_target",
  "order_channel",
  "order_target",
  "business_status",
  "business_status_at",
  "orders_enabled",
  "reservations_enabled",
  // The four acceptance intent bits, legalized for admin-web-set-place-rails
  // (Pato gate 2026-08-29, the Partner tab toggles + Promotion score). They
  // are PLACES-ONLY patch keys — see PLACE_INTENT_BIT_KEYS below.
  "mesita_pay_enabled",
  "credits_enabled",
  "pickup_orders_enabled",
  "delivery_orders_enabled",
] as const satisfies readonly (keyof Omit<
  PlaceRow,
  "id" | "created_at" | "updated_at" | "name"
>)[];

// Compile-time exhaustiveness the other direction — same discipline
// CONSUMER_PATCH_KEYS uses (borrowed from PULSE_PIECE_META, MESITA-1222): a
// field added to PlaceRow and forgotten here fails the build, not a review.
type _MissingFromPlacePatchKeys = Exclude<
  keyof Omit<PlaceRow, "id" | "created_at" | "updated_at" | "name">,
  typeof PLACE_PATCH_KEYS[number]
>;
const _assertNoMissingPlaceKeys: _MissingFromPlacePatchKeys extends never ? true
  : ["PLACE_PATCH_KEYS is missing a field from PlaceRow", _MissingFromPlacePatchKeys] = true;
void _assertNoMissingPlaceKeys;

export type PlacePatch = Partial<Pick<PlaceRow, typeof PLACE_PATCH_KEYS[number]>>;

// ── ProjectRow — the full `projects` row shape ──────────────────────────────

export type ProjectRow = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  status: "lead" | "active" | "paused" | "archived" | "pending_review" | "pending_verification";
  listing_type: "partner" | "web" | "unclaimed";
  plan: "free" | "pro" | "ultra";
  fiscal_type: "formal" | "informal";
  content_status: "queued" | "generating" | "ready" | "failed";
  currency: string;
  segmentation_basic_enabled: boolean;
  segmentation_advanced_enabled: boolean;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  monthly_promo_cap: number | null;
  discount_cap_cents: number | null;
  staff_channel_pinged_at: string | null;
  first_ticket_honored_at: string | null;
  plan_live_at: string | null;
  strike_count: number;
  last_strike_at: string | null;
  promo_paused_until: string | null;
  plan_forfeited_at: string | null;
  check_pin: string | null;
  cfdi_rfc: string | null;
  cfdi_razon_social: string | null;
  cfdi_cp: string | null;
  reward_lane_pending_review_at: string | null;
};

export const PROJECT_PATCH_KEYS = [
  "slug",
  "status",
  "listing_type",
  "plan",
  "fiscal_type",
  "content_status",
  "currency",
  "segmentation_basic_enabled",
  "segmentation_advanced_enabled",
  "welcome_free_rate",
  "welcome_premium_rate",
  "free_rate",
  "premium_rate",
  "monthly_promo_cap",
  "discount_cap_cents",
  "staff_channel_pinged_at",
  "first_ticket_honored_at",
  "plan_live_at",
  "strike_count",
  "last_strike_at",
  "promo_paused_until",
  "plan_forfeited_at",
  "check_pin",
  "cfdi_rfc",
  "cfdi_razon_social",
  "cfdi_cp",
  "reward_lane_pending_review_at",
] as const satisfies readonly (keyof Omit<ProjectRow, "id" | "created_at" | "updated_at">)[];

type _MissingFromProjectPatchKeys = Exclude<
  keyof Omit<ProjectRow, "id" | "created_at" | "updated_at">,
  typeof PROJECT_PATCH_KEYS[number]
>;
const _assertNoMissingProjectKeys: _MissingFromProjectPatchKeys extends never ? true
  : ["PROJECT_PATCH_KEYS is missing a field from ProjectRow", _MissingFromProjectPatchKeys] = true;
void _assertNoMissingProjectKeys;

export type ProjectPatch = Partial<Pick<ProjectRow, typeof PROJECT_PATCH_KEYS[number]>>;

/** The `profiles` view's writable surface — both tables' patch keys at once. */
export type ProfilePatch = PlacePatch & ProjectPatch;

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
function isIntInRange(v: unknown, min: number, max: number): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}
function isNullableNonNegInt(v: unknown): boolean {
  return v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0);
}
function isNullableLegalSet(v: unknown, legal: readonly number[]): boolean {
  return v === null || (typeof v === "number" && (legal as readonly number[]).includes(v));
}
function isNullableRegex(v: unknown, re: RegExp): boolean {
  return v === null || (typeof v === "string" && re.test(v));
}
function isNullableLenString(v: unknown, min: number, max: number): boolean {
  return v === null || (typeof v === "string" && v.length >= min && v.length <= max);
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

// ── places_* field groups (mirrors the live CHECK constraints named) ───────

const PLACE_PLAIN_STRING_KEYS = new Set<string>([
  "category", "vibe", "address", "timezone", "closes_at", "phone", "pitch",
  "story", "website_url", "instagram_url", "facebook_url",
  "whatsapp_url", "opentable_url", "resy_url", "uber_eats_url", "x_url",
  "threads_url", "reddit_url", "google_maps_url",
  "didi_food_url", "email", "embedding_source_hash", "country", "description",
  "menu_pdf_url", "google_business_url", "menu_pdf_name", "editorial_summary",
  "zone", "city", "executive_chef", "category_label",
  "embedding_source_text", "google_name", "description_es", "mesita_name",
  "reservation_target", "order_target", "embedding", "name_embedding",
  "name_embedding_hash", "google_place_id",
  "enriched_at", "business_status_at", "enrich_next_at",
]);
const PLACE_UNRANGED_NUMBER_KEYS = new Set<string>(["lat", "lng", "established_year"]);
// places_{google,mesita}_stars_*_check / places_facebook_rating_check /
// places_mesita_stars_value_check — 0..5 inclusive, null allowed.
const PLACE_STAR_RATING_KEYS = new Set<string>([
  "google_stars_overall", "mesita_stars_overall", "mesita_stars_food",
  "mesita_stars_service", "mesita_stars_ambience", "facebook_rating",
  "mesita_stars_value",
]);
// places_{google,mesita}_*_count_check / places_instagram_followers_count_check
// / places_facebook_followers_check — >= 0, null allowed (a raw `col >= 0`
// CHECK still passes NULL under Postgres 3-valued logic).
const PLACE_NONNEG_INT_KEYS = new Set<string>([
  "google_review_count", "google_visitor_count", "mesita_review_count",
  "mesita_visitor_count", "instagram_followers_count", "facebook_followers",
]);
// hours/enrichment_sources/menus/products stay opaque (isJsonish) — no
// schema exists for their internal shape yet. details/google_reviews/
// popular_times moved OUT of this set (MESITA-1247 reconciliation, see
// PLACE_SCHEMA_JSON_KEYS below): place-jsonb-schemas.ts already validates
// their content, and PR #1163 first shipped that validation only at two
// caller-side gates (enrich-synthesis-profile.ts, enrich-google-basics.ts)
// plus a competing, uncalled `update-place.ts` door — folding the same
// schemas in HERE, at the one real door, closes the gap for every OTHER
// caller these three fields would otherwise pass through unvalidated (this
// door's own PROJECT/PROFILE surfaces, save-place.ts's create insert, and
// any future writer), not just the two hand-patched call sites.
const PLACE_JSON_KEYS = new Set<string>([
  "hours", "enrichment_sources", "menus", "products",
]);
// Content-validated JSONB keys — nullable() wraps each schema because the
// column itself is nullable and a patch clearing it to null must stay legal
// (place-jsonb-schemas.ts's own schemas reject bare `null`, by design, since
// they are also used where absence already means "don't touch this field").
const PLACE_SCHEMA_JSON_KEYS: Record<string, { parse(v: unknown): { ok: boolean; error?: string } }> = {
  details: nullable(PlaceDetailsSchema),
  google_reviews: nullable(GoogleReviewsSchema),
  popular_times: nullable(PopularTimesSchema),
  // NOT nullable — places.enrichment is NOT NULL with a default (MESITA-1249).
  enrichment: EnrichmentMapSchema,
};
const PLACE_STRING_ARRAY_KEYS = new Set<string>([
  "photos", "tags", "whatsapp_pr_urls", "instagram_pr_urls",
]);
// NOT NULL boolean columns, default false. orders_enabled /
// reservations_enabled joined PLACE_PATCH_KEYS in #1395 but never got a
// checkPlaceField branch — every patch carrying them fell through to
// "unknown place field" and the WHOLE patch was rejected (latent until the
// 2026-08-29 EF redeploy sweep put the door in front of the live contents
// publish; caught and fixed the same day). The four intent bits ride the
// same branch.
const PLACE_BOOLEAN_KEYS = new Set<string>([
  "orders_enabled", "reservations_enabled",
  "mesita_pay_enabled", "credits_enabled",
  "pickup_orders_enabled", "delivery_orders_enabled",
]);
// Acceptance intent bits are PLACES-ONLY: the profiles view's INSTEAD OF
// trigger (profiles_update) enumerates its SET list and predates these
// columns, so a profiles-routed patch would silently drop them — the door
// refuses loudly instead. Their one writer (admin-web-set-place-rails)
// targets `table: "places"`.
const PLACE_INTENT_BIT_KEYS = new Set<string>([
  "mesita_pay_enabled", "credits_enabled",
  "pickup_orders_enabled", "delivery_orders_enabled",
]);
const BUSINESS_STATUS_VALUES = new Set(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);
const ENRICH_MODE_VALUES = new Set(["full", "analysis", "contents"]);

function checkPlaceField(key: string, v: unknown): string | null {
  if (PLACE_BOOLEAN_KEYS.has(key)) {
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
    // places_price_level_check
    case "price_level":
      return isNullableRange(v, 1, 4) ? null : "price_level must be between 1 and 4, or null";
    // places_enrich_every_days_range
    case "enrich_every_days":
      return isNullableRange(v, 1, 365) ? null
        : "enrich_every_days must be between 1 and 365, or null";
    // places_enrich_mode_kind — NOT NULL
    case "enrich_mode":
      return isNonNullEnum(v, ENRICH_MODE_VALUES) ? null
        : "enrich_mode must be one of full, analysis, contents";
    // places_business_status_check
    case "business_status":
      return v === null || (typeof v === "string" && BUSINESS_STATUS_VALUES.has(v)) ? null
        : "business_status must be OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY, or null";
    // places_reservation_channel_check / places_order_channel_check
    case "reservation_channel":
    case "order_channel":
      return v === null || isServingChannel(v) ? null
        : `${key} must be phone, whatsapp, instagram, web, none, or null`;
    default:
      return `unknown place field: ${key}`;
  }
}

/**
 * places_name_source_present: COALESCE(NULLIF(btrim(mesita_name),''),
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
      "(places_name_source_present — places.name would have nothing to generate from)";
  }
  return null;
}

export type PlacePatchValidation =
  | { ok: true; patch: PlacePatch }
  | { ok: false; error: string };

export function validatePlacePatch(input: unknown): PlacePatchValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "place patch must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!(PLACE_PATCH_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown place field: ${key}` };
    }
    const err = checkPlaceField(key, raw[key]);
    if (err) return { ok: false, error: err };
    patch[key] = raw[key];
  }
  const nameErr = checkPlaceNameSourceInvariant(patch);
  if (nameErr) return { ok: false, error: nameErr };
  return { ok: true, patch: patch as PlacePatch };
}

// ── projects_* field groups (mirrors the live CHECK constraints named) ─────

const PROJECT_NOTNULL_STRING_KEYS = new Set<string>(["slug", "currency"]);
const PROJECT_BOOLEAN_KEYS = new Set<string>([
  "segmentation_basic_enabled", "segmentation_advanced_enabled",
]);
// projects_promo_rate_legal_values — {10,20,30,40,50}, null allowed.
const PROJECT_RATE_KEYS = new Set<string>([
  "welcome_free_rate", "welcome_premium_rate", "free_rate", "premium_rate",
]);
const PROJECT_TIMESTAMP_KEYS = new Set<string>([
  "staff_channel_pinged_at", "first_ticket_honored_at", "plan_live_at",
  "last_strike_at", "promo_paused_until", "plan_forfeited_at",
  "reward_lane_pending_review_at",
]);
const RATE_LEGAL_VALUES = [10, 20, 30, 40, 50] as const;
const PROMO_CAP_LEGAL_VALUES = [200, 500, 1000] as const;
const CFDI_RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
const CFDI_CP_RE = /^[0-9]{5}$/;
const SIX_DIGIT_PIN_RE = /^[0-9]{6}$/;

const STATUS_VALUES = new Set([
  "lead", "active", "paused", "archived", "pending_review", "pending_verification",
]);
const LISTING_TYPE_VALUES = new Set(["partner", "web", "unclaimed"]);
const PLAN_VALUES = new Set(["free", "pro", "ultra"]);
const FISCAL_TYPE_VALUES = new Set(["formal", "informal"]);
const CONTENT_STATUS_VALUES = new Set(["queued", "generating", "ready", "failed"]);

function checkProjectField(key: string, v: unknown): string | null {
  if (PROJECT_NOTNULL_STRING_KEYS.has(key)) {
    return isNonEmptyString(v) ? null : `${key} must be a non-empty string`;
  }
  if (PROJECT_BOOLEAN_KEYS.has(key)) {
    return isBoolean(v) ? null : `${key} must be a boolean`;
  }
  if (PROJECT_RATE_KEYS.has(key)) {
    return isNullableLegalSet(v, RATE_LEGAL_VALUES) ? null
      : `${key} must be null or one of ${RATE_LEGAL_VALUES.join(", ")}`;
  }
  if (PROJECT_TIMESTAMP_KEYS.has(key)) {
    return isNullableString(v) ? null : `${key} must be an ISO timestamp string or null`;
  }
  switch (key) {
    // Postgres enum columns — NOT NULL at the type level.
    case "status":
      return isNonNullEnum(v, STATUS_VALUES) ? null
        : `status must be one of ${[...STATUS_VALUES].join(", ")}`;
    case "listing_type":
      return isNonNullEnum(v, LISTING_TYPE_VALUES) ? null
        : `listing_type must be one of ${[...LISTING_TYPE_VALUES].join(", ")}`;
    case "plan":
      return isNonNullEnum(v, PLAN_VALUES) ? null
        : `plan must be one of ${[...PLAN_VALUES].join(", ")}`;
    case "fiscal_type":
      return isNonNullEnum(v, FISCAL_TYPE_VALUES) ? null
        : `fiscal_type must be one of ${[...FISCAL_TYPE_VALUES].join(", ")}`;
    case "content_status":
      return isNonNullEnum(v, CONTENT_STATUS_VALUES) ? null
        : `content_status must be one of ${[...CONTENT_STATUS_VALUES].join(", ")}`;
    // projects_monthly_promo_cap_legal_values
    case "monthly_promo_cap":
      return isNullableLegalSet(v, PROMO_CAP_LEGAL_VALUES) ? null
        : `monthly_promo_cap must be null or one of ${PROMO_CAP_LEGAL_VALUES.join(", ")}`;
    // projects_reward_cap_cents_check
    case "discount_cap_cents":
      return isNullableNonNegInt(v) ? null : "discount_cap_cents must be a non-negative integer, or null";
    // projects_strike_count_range — NOT NULL
    case "strike_count":
      return isIntInRange(v, 0, 3) ? null : "strike_count must be an integer between 0 and 3";
    // projects_check_pin_format
    case "check_pin":
      return isNullableRegex(v, SIX_DIGIT_PIN_RE) ? null
        : `${key} must be exactly 6 digits, or null`;
    // projects_cfdi_rfc_shape
    case "cfdi_rfc":
      return isNullableRegex(v, CFDI_RFC_RE) ? null
        : "cfdi_rfc must match the RFC shape (3-4 letters, 6 digits, 3 alnum), or null";
    // projects_cfdi_cp_shape
    case "cfdi_cp":
      return isNullableRegex(v, CFDI_CP_RE) ? null : "cfdi_cp must be exactly 5 digits, or null";
    // projects_cfdi_razon_social_len
    case "cfdi_razon_social":
      return isNullableLenString(v, 1, 200) ? null
        : "cfdi_razon_social must be 1-200 characters, or null";
    default:
      return `unknown project field: ${key}`;
  }
}

export type ProjectPatchValidation =
  | { ok: true; patch: ProjectPatch }
  | { ok: false; error: string };

export function validateProjectPatch(input: unknown): ProjectPatchValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "project patch must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!(PROJECT_PATCH_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown project field: ${key}` };
    }
    const err = checkProjectField(key, raw[key]);
    if (err) return { ok: false, error: err };
    patch[key] = raw[key];
  }
  return { ok: true, patch: patch as ProjectPatch };
}

export type ProfilePatchValidation =
  | { ok: true; patch: ProfilePatch }
  | { ok: false; error: string };

/**
 * Validates a patch against the `profiles` view's combined writable surface
 * — places fields and projects fields in the SAME patch, exactly what every
 * existing caller writing through that view already sends (the view's
 * INSTEAD OF trigger splits it across both tables in one statement; see the
 * file header). PLACE_PATCH_KEYS and PROJECT_PATCH_KEYS are disjoint —
 * checked directly by
 * "place-doc.test.ts: PLACE_PATCH_KEYS and PROJECT_PATCH_KEYS never collide".
 */
export function validateProfilePatch(input: unknown): ProfilePatchValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "profile patch must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    // Places-only keys: the profiles_update trigger predates these columns
    // and would silently drop them — refuse loudly (see PLACE_INTENT_BIT_KEYS).
    if (PLACE_INTENT_BIT_KEYS.has(key)) {
      return {
        ok: false,
        error: `${key} writes through table "places" only — ` +
          `the profiles trigger would silently drop it`,
      };
    }
    const isPlaceKey = (PLACE_PATCH_KEYS as readonly string[]).includes(key);
    const isProjectKey = (PROJECT_PATCH_KEYS as readonly string[]).includes(key);
    if (!isPlaceKey && !isProjectKey) {
      return { ok: false, error: `unknown profile field: ${key}` };
    }
    const err = isPlaceKey ? checkPlaceField(key, raw[key]) : checkProjectField(key, raw[key]);
    if (err) return { ok: false, error: err };
    patch[key] = raw[key];
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
  | { table: "places"; mode: "insert"; patch: PlacePatch; select?: string; selectMode?: SelectMode }
  | {
    table: "places";
    mode: "update";
    id: string;
    patch: PlacePatch;
    select?: string;
    selectMode?: SelectMode;
  }
  | { table: "places"; mode: "delete"; id: string }
  | {
    table: "projects";
    mode: "insert";
    id: string;
    patch: ProjectPatch;
    select?: string;
    selectMode?: SelectMode;
  }
  | {
    table: "projects";
    mode: "update";
    id: string;
    patch: ProjectPatch;
    select?: string;
    selectMode?: SelectMode;
    /** Extra `.eq()` guard(s) beyond `id` — an optimistic-concurrency check
     * an existing call site already runs (e.g. `.eq("plan", planKey)` so a
     * revoke doesn't clobber a plan that changed underneath it). */
    guard?: Record<string, string>;
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
 * public.places, public.projects, or the public.profiles view in the
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
    args.mode === "update" && (args.table === "places" || args.table === "profiles") &&
    "google_place_id" in (args.patch as Record<string, unknown>)
  ) {
    return {
      ok: false,
      error: "google_place_id is immutable once set — only the create path may write it",
    };
  }

  const validated = args.table === "places"
    ? validatePlacePatch(args.patch)
    : args.table === "projects"
    ? validateProjectPatch(args.patch)
    : validateProfilePatch(args.patch);
  if (!validated.ok) return { ok: false, error: validated.error };

  const selectMode = args.selectMode ?? "single";

  if (args.mode === "insert") {
    const row: Record<string, unknown> = args.table === "projects"
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
  if (args.table === "projects" && args.guard) {
    for (const [col, val] of Object.entries(args.guard)) {
      updateBuilder = updateBuilder.eq(col, val);
    }
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
