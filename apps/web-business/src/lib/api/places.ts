// Frontend API surface for place Edge Functions.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper here calls exactly one Edge Function and never composes
//   multiple Edge Functions (composition belongs inside the function).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { BusinessRole } from "./team";

type PlaceListingType = "partner" | "web";
type PlaceStatus =
  | "lead"
  | "active"
  | "paused"
  | "archived"
  | "pending_review"
  | "pending_verification";

type FiscalType = "formal" | "informal";
// Place plan keys (public.membership enum): Free + Verified (`pro`,
// MX$1,000/year Promos v4 membership) + legacy `ultra`. Billing goes through
// business-web-change-subscription — see lib/business/plans.ts and
// lib/api/subscription.ts.
export type PlacePlan = "free" | "pro" | "ultra";

// Weekly opening hours — JSONB column on places. Lowercase English day keys,
// each holding an array of {open,close} ranges in 24h HH:MM. Closed days omit
// the key entirely. Multiple ranges per day support split shifts.
export type PlaceHours = Partial<
  Record<
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday",
    { open: string; close: string }[]
  >
>;

type Place = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  category_label: string | null;
  /** Super Categories: Intaker-inferred (stored); membership derives live. */
  family_keys?: string[] | null;
  vibe: string | null;
  price_level: number | null;
  // ISO 4217 currency code (e.g. "MXN", "USD"). Every monetary amount
  // on this place — price ranges, reward cap, future cover charges —
  // is denominated in this currency. Defaults to MXN on the DB side.
  currency: string;
  listing_type: PlaceListingType;
  status: PlaceStatus;
  fiscal_type: FiscalType;
  plan: PlacePlan;
  lat: number | null;
  lng: number | null;
  address: string | null;
  timezone: string | null;
  closes_at: string | null;
  hours: PlaceHours | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  description: string | null;
  // Four per-tier promo rates (DB migration 0032). Welcome variants fire on
  // a guest's first visit at this place; the unprefixed variants apply on
  // every visit afterwards. Each is one of 10 / 20 / 50 / 70 or null.
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  // Place-level monthly promo spend cap (DB migration 0038), in `currency`.
  // One of 200 / 500 / 1000 or null (no cap).
  monthly_promo_cap: number | null;
  // Promos v4 membership / strikes (MESITA-542).
  first_ticket_honored_at?: string | null;
  plan_live_at?: string | null;
  strike_count?: number | null;
  last_strike_at?: string | null;
  promo_paused_until?: string | null;
  plan_forfeited_at?: string | null;
  /** Ghost-partner hold (MESITA-1311): a confirmed guest report closed the
   *  reward lane; Mesita clears it when the review ends. Null = no hold. */
  reward_lane_pending_review_at?: string | null;
  photos: string[];
  menu_pdf_url: string | null;
  // Display name paired with menu_pdf_url (e.g. "Dinner menu"). Null
  // means the consumer falls back to the generic "Full menu" copy.
  menu_pdf_name: string | null;
  // Generic products payload. Menus are carried in products.menu.
  products: Record<string, unknown> | null;
  // Legacy parallel array; prefer products.menu when present.
  menus?: Array<{ name?: string | null; url?: string | null }> | null;
  tags: string[];
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
  didi_food_url: string | null;
  google_maps_url: string | null;
  google_business_url: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  google_visitor_count: number | null;
  /** Raw Google review rows (JSONB); Performance extracts display items. */
  google_reviews?: unknown;
  /** Raw Mesita visitor/review rows; Performance extracts display items. */
  mesita_visitors?: unknown;
  mesita_stars_overall: number | null;
  mesita_stars_food: number | null;
  mesita_stars_service: number | null;
  mesita_stars_ambience: number | null;
  mesita_review_count: number | null;
  mesita_visitor_count: number | null;
  instagram_followers_count: number | null;
  // Promos page section toggles. Persisted so the business's on/off
  // choice survives reloads. Defaults: basic=true, advanced=false.
  segmentation_basic_enabled: boolean;
  segmentation_advanced_enabled: boolean;
  email: string | null;
  created_at: string;
};

export type MyPlace = Place & {
  my_role: BusinessRole;
  updated_at?: string;
  // Owner-only staff Check PIN (MESITA-823). Attached by
  // business-web-get-overview on the active place when my_role=owner;
  // absent for editors/viewers and never present on the profiles view.
  check_pin?: string | null;
};

// Per-row state mirrored from the lookup EF, plus a self/other split
// for the owned case so the picker can flag "you own this" inline.
export type PredictionStatus =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  // Drives the per-row badge in the picker.
  status: PredictionStatus;
};

type EnrichmentReport = {
  google: boolean;
  /** Number of photos actually persisted on the place after the
   *  gpt-4o-mini vision rank. The EF sources up to MAX_PHOTOS (20)
   *  candidates and keeps only the top MAX_PHOTOS_TO_KEEP (10) after
   *  scoring for Mesita-fit (vibe / sharpness / evergreen). The
   *  dropped candidates are discarded — never written. */
  photoCount: number;
  /** Raw candidate-pool size before the vision rank. Lets the admin
   *  UI tell the difference between "we only found 3 photos for this
   *  place" and "we found 20 and the ranker kept the best 10". */
  photoCandidates?: number;
  /** True when gpt-4o-mini vision successfully scored the candidate
   *  pool. False = ranking fell back to source-priority order (CSE >
   *  Firecrawl > Places) and still capped at MAX_PHOTOS_TO_KEEP. */
  photoRanked?: boolean;
  /** Short reason when photoRanked is false: no_openai_key,
   *  openai_http_<status>, parse:<msg>, exception:<msg>. Useful for
   *  ops triage; never surfaced to operators. */
  photoRankError?: string | null;
  firecrawl: boolean;
  perplexity: boolean;
  openai: boolean;
  openaiError?: string | null;
  /** Number of channel columns (URLs + email) auto-classified from the
   *  enrichment pass. Lets the UI brag "We pulled 9 of your channels". */
  channelCount?: number;
};

export async function apiPlacesAutocomplete(
  client: SupabaseClient,
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];
  const { predictions } = await invokeEF<{ predictions: PlacePrediction[] }>(
    client,
    "business-web-suggest-places",
    { input: trimmed, sessionToken },
    "Couldn't search places right now.",
  );
  return predictions;
}

type EnrichCreatePlaceResponse = {
  place: { id: string; slug: string; name: string; status: PlaceStatus };
  enrichment: EnrichmentReport;
};

export async function apiEnrichCreatePlace(
  client: SupabaseClient,
  googlePlaceId: string,
): Promise<EnrichCreatePlaceResponse> {
  return invokeEF<EnrichCreatePlaceResponse>(
    client,
    "business-web-create-project",
    // Canonical Google Place ID key (MESITA-53 Addendum 9). The EF still
    // accepts legacy `placeId` server-side, but new callers send googlePlaceId.
    { googlePlaceId },
    "Couldn't create that place.",
  );
}

export type UpdatePlaceInput = {
  id: string;
  name?: string;
  category?: string | null;
  vibe?: string | null;
  // price_level is enrich-only (Google Places) — not accepted by
  // business-web-update-project.
  // Three-letter ISO 4217 code, e.g. "MXN". Sent uppercase; the EF
  // validates the shape and rejects anything else.
  currency?: string | null;
  status?: "active" | "paused" | "archived";
  fiscal_type?: FiscalType;
  // NOTE: no `plan` here — plan changes are billing and go through
  // apiChangeSubscription (business-web-change-subscription EF).
  address?: string | null;
  closes_at?: string | null;
  hours?: PlaceHours | null;
  phone?: string | null;
  pitch?: string | null;
  story?: string | null;
  // Four per-tier promo rates. One of the tens grid 10 / 20 / 30 / 40 / 50 or
  // null to clear. Written together by the Promos strategy presets.
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
  // Monthly promo spend cap. One of 200 / 500 / 1000 or null to clear.
  monthly_promo_cap?: number | null;
  photos?: string[];
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  whatsapp_url?: string | null;
  opentable_url?: string | null;
  resy_url?: string | null;
  uber_eats_url?: string | null;
  x_url?: string | null;
  threads_url?: string | null;
  reddit_url?: string | null;
  didi_food_url?: string | null;
  google_maps_url?: string | null;
  email?: string | null;
  // Place-redesign editable surface (Business-E=YES in Notion Components).
  description?: string | null;
  menu_pdf_url?: string | null;
  menu_pdf_name?: string | null;
  // Products-first aliases (mapped server-side to menu_pdf_* for now).
  product_catalog_url?: string | null;
  product_catalog_name?: string | null;
  products?: { menu?: unknown[] | null } | null;
  tags?: string[];
  // Promos page section toggles — persisted so they survive reloads.
  segmentation_basic_enabled?: boolean;
  segmentation_advanced_enabled?: boolean;
};

type UpdatedPlace = Place & {
  updated_at: string;
};

export async function apiUpdatePlace(
  client: SupabaseClient,
  input: UpdatePlaceInput,
): Promise<UpdatedPlace> {
  const { place } = await invokeEF<{ place: UpdatedPlace }>(
    client,
    "business-web-update-project",
    input,
  );
  return place;
}
