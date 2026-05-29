// Frontend API surface for venue Edge Functions.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper here calls exactly one Edge Function and never composes
//   multiple Edge Functions (composition belongs inside the function).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

type VenueListingType = "partner" | "web";
type VenueStatus = "lead" | "active" | "paused" | "archived";

export type FiscalType = "formal" | "informal";
// Five-plan venue catalog: Free (default) + Pro and Ultra at each fiscal
// type. The mechanic (cashback vs discount) is fixed by fiscal_type — Pro
// and Ultra differ only in price and visibility. See lib/business/plans.ts
// for the picker catalog and visibility/mechanic mappings.
export type VenuePlan =
  | "free"
  | "formal_pro"
  | "formal_ultra"
  | "informal_pro"
  | "informal_ultra";

// Weekly opening hours — JSONB column on venues. Lowercase English day keys,
// each holding an array of {open,close} ranges in 24h HH:MM. Closed days omit
// the key entirely. Multiple ranges per day support split shifts.
export type VenueHours = Partial<
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

type Venue = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  vibe: string | null;
  price_level: number | null;
  // ISO 4217 currency code (e.g. "MXN", "USD"). Every monetary amount
  // on this venue — price ranges, reward cap, future cover charges —
  // is denominated in this currency. Defaults to MXN on the DB side.
  currency: string;
  listing_type: VenueListingType;
  status: VenueStatus;
  fiscal_type: FiscalType;
  plan: VenuePlan;
  lat: number | null;
  lng: number | null;
  address: string | null;
  timezone: string | null;
  closes_at: string | null;
  hours: VenueHours | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  description: string | null;
  cashback_percent: number | null;
  // Four per-tier promo rates (DB migration 0032). Welcome variants fire on
  // a guest's first visit at this venue; the unprefixed variants apply on
  // every visit afterwards. Each is one of 10 / 20 / 50 / 70 or null.
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  photos: string[];
  menu_pdf_url: string | null;
  // Display name paired with menu_pdf_url (e.g. "Dinner menu"). Null
  // means the consumer falls back to the generic "Full menu" copy.
  menu_pdf_name: string | null;
  tags: string[];
  whatsapp_pr_urls: string[];
  instagram_pr_urls: string[];
  website_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  opentable_url: string | null;
  resy_url: string | null;
  uber_eats_url: string | null;
  rappi_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
  threads_url: string | null;
  reddit_url: string | null;
  didi_food_url: string | null;
  tripadvisor_url: string | null;
  google_maps_url: string | null;
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
  // Promos page section toggles. Persisted so the business's on/off
  // choice survives reloads. Defaults: basic=true, advanced=false.
  segmentation_basic_enabled: boolean;
  segmentation_advanced_enabled: boolean;
  email: string | null;
  created_at: string;
};

export type MyVenue = Venue & {
  my_role: "owner" | "editor" | "staff";
  updated_at?: string;
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
  /** Number of photos actually persisted on the venue after the
   *  gpt-4o-mini vision rank. The EF sources up to MAX_PHOTOS (20)
   *  candidates and keeps only the top MAX_PHOTOS_TO_KEEP (10) after
   *  scoring for Mesita-fit (vibe / sharpness / evergreen). The
   *  dropped candidates are discarded — never written. */
  photoCount: number;
  /** Raw candidate-pool size before the vision rank. Lets the admin
   *  UI tell the difference between "we only found 3 photos for this
   *  venue" and "we found 20 and the ranker kept the best 10". */
  photoCandidates?: number;
  /** True when gpt-4o-mini vision successfully scored the candidate
   *  pool. False = ranking fell back to source-priority order (CSE >
   *  Firecrawl > Places) and still capped at MAX_PHOTOS_TO_KEEP. */
  photoRanked?: boolean;
  /** Short reason when photoRanked is false: no_openai_key,
   *  openai_http_<status>, parse:<msg>, exception:<msg>. Useful for
   *  ops triage; never surfaced to businesses. */
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
    "business-suggest-places",
    { input: trimmed, sessionToken },
    "Couldn't search venues right now.",
  );
  return predictions;
}

type EnrichCreateVenueResponse = {
  venue: { id: string; slug: string; name: string; status: VenueStatus };
  enrichment: EnrichmentReport;
};

export async function apiEnrichCreateVenue(
  client: SupabaseClient,
  placeId: string,
): Promise<EnrichCreateVenueResponse> {
  return invokeEF<EnrichCreateVenueResponse>(
    client,
    "business-create-unit",
    { placeId },
    "Couldn't create that venue.",
  );
}

export type UpdateVenueInput = {
  id: string;
  name?: string;
  category?: string | null;
  vibe?: string | null;
  price_level?: number | null;
  // Three-letter ISO 4217 code, e.g. "MXN". Sent uppercase; the EF
  // validates the shape and rejects anything else.
  currency?: string | null;
  status?: "active" | "paused" | "archived";
  fiscal_type?: FiscalType;
  plan?: VenuePlan;
  address?: string | null;
  closes_at?: string | null;
  hours?: VenueHours | null;
  phone?: string | null;
  pitch?: string | null;
  story?: string | null;
  cashback_percent?: number | null;
  // Four per-tier promo rates. One of 10 / 20 / 50 / 70 or null to clear.
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
  photos?: string[];
  website_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  facebook_url?: string | null;
  whatsapp_url?: string | null;
  opentable_url?: string | null;
  resy_url?: string | null;
  uber_eats_url?: string | null;
  rappi_url?: string | null;
  x_url?: string | null;
  youtube_url?: string | null;
  threads_url?: string | null;
  reddit_url?: string | null;
  didi_food_url?: string | null;
  tripadvisor_url?: string | null;
  google_maps_url?: string | null;
  email?: string | null;
  // Place-redesign editable surface (Business-E=YES in Notion Components).
  description?: string | null;
  menu_pdf_url?: string | null;
  menu_pdf_name?: string | null;
  tags?: string[];
  whatsapp_pr_urls?: string[];
  instagram_pr_urls?: string[];
  // Promos page section toggles — persisted so they survive reloads.
  segmentation_basic_enabled?: boolean;
  segmentation_advanced_enabled?: boolean;
};

type UpdatedVenue = Venue & {
  phone: string | null;
  updated_at: string;
};

export async function apiUpdateVenue(
  client: SupabaseClient,
  input: UpdateVenueInput,
): Promise<UpdatedVenue> {
  // Super-admin elevation is now per-user: the EF reads the caller's JWT,
  // checks public.super_admins, and skips venue_members for allowlisted
  // emails. The browser doesn't need to know — supabase-js attaches the
  // JWT automatically.
  const { venue } = await invokeEF<{ venue: UpdatedVenue }>(
    client,
    "business-update-unit",
    input,
  );
  return venue;
}
