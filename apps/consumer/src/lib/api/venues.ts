// Frontend API surface for the consumer-facing venue Edge Functions.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper here calls exactly one Edge Function and never composes
//   multiple Edge Functions (composition belongs inside the function).
//
// Business-side helpers (places autocomplete, create / update / delete
// venue, enrichment) live in the business app — consumer never invokes them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

type VenueListingType = "partner" | "web";
type VenueStatus = "lead" | "active" | "paused" | "archived";
type FiscalType = "formal" | "informal";
// Five-plan venue catalog: Free (default) + Pro and Ultra at each fiscal
// type. The mechanic (cashback vs discount) is fixed by fiscal_type.
type VenuePlan =
  | "free"
  | "formal_pro"
  | "formal_ultra"
  | "informal_pro"
  | "informal_ultra";

export type Venue = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  vibe: string | null;
  price_level: number | null;
  // ISO 4217 code from public.venues.currency (default "MXN"). Every
  // monetary amount on this venue — price ranges, reward caps,
  // future cover charges — is denominated in this currency so the
  // UI can render the right prefix ("MX$", "$", "€") without
  // hard-coding it.
  currency: string;
  listing_type: VenueListingType;
  status: VenueStatus;
  fiscal_type: FiscalType;
  plan: VenuePlan;
  lat: number | null;
  lng: number | null;
  address: string | null;
  closes_at: string | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  cashback_percent: number | null;
  photos: string[];
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
  email: string | null;
  created_at: string;

  // ── Overview parity (optional) ────────────────────────────────────
  //
  // The swipe / catalog cards used to show only what's strictly on the
  // venues row (name, vibe, category, price_level, closes_at, cashback).
  // The "all info on the tinder card too" checkpoint widens that to
  // mirror the venue-detail overview grid. Every field below is
  // optional because the recommend-deck / list-venues EFs don't return
  // them yet — the card hides cells when the field is null/undefined,
  // so the contract degrades cleanly until the EF starts populating
  // them (sourced from Google Places + cached on the row).
  google_rating?: number | null;
  google_count?: number | null;
  /** Pre-formatted with the currency prefix, e.g. "MX$200–300". */
  price_range?: string | null;
  /** Short relative timestamp like "2 days ago" (server-formatted). */
  last_updated_label?: string | null;
  open_now?: boolean | null;
  opens_at?: string | null;
  distance_km?: number | null;
  zone?: string | null;
  /** Per-visit cashback ceiling in the venue's currency. */
  reward_cap_mxn?: number | null;
};

// Discover surfaces (swipe + catalog) — both go through dedicated EFs
// that do bounding-box prefiltering + lazy embedding + RAG ranking. The
// helpers below are thin invokers; all the curation logic lives in the
// EFs so we can iterate on it without redeploying the web app.
type RecommendDeckInput = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
};
type RecommendDeckResponse = {
  deck: Venue[];
  summary: { candidates: number; embedded: number; intent?: string };
};
export type CatalogCategory = {
  key: string;
  label: string;
  description: string;
  emoji: string;
  venues: Venue[];
};
type RecommendCatalogInput = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  maxCategories?: number;
  perCategory?: number;
};
type RecommendCatalogResponse = {
  categories: CatalogCategory[];
  summary: { candidates: number; embedded?: number; categoryCount: number };
};

export async function apiFetchPublicVenues(
  client: SupabaseClient,
  limit = 50,
): Promise<Venue[]> {
  const { venues } = await invokeEF<{ venues: Venue[] }>(
    client,
    "consumer-list-venues",
    { limit },
  );
  return venues.map(stripInsecurePhotos);
}
export async function apiRecommendDeck(
  client: SupabaseClient,
  input: RecommendDeckInput = {},
): Promise<RecommendDeckResponse> {
  const data = await invokeEF<RecommendDeckResponse>(
    client,
    "consumer-recommend-deck",
    input,
  );
  return { deck: data.deck.map(stripInsecurePhotos), summary: data.summary };
}

export async function apiRecommendCatalog(
  client: SupabaseClient,
  input: RecommendCatalogInput = {},
): Promise<RecommendCatalogResponse> {
  const data = await invokeEF<RecommendCatalogResponse>(
    client,
    "consumer-recommend-catalog",
    input,
  );
  return {
    categories: data.categories.map((c) => ({
      ...c,
      venues: c.venues.map(stripInsecurePhotos),
    })),
    summary: data.summary,
  };
}
// Per-row status mirrored from atlas-suggest-venue. Drives the badge
// in the consumer search picker:
//   - not_in_mesita: Google has it, Mesita doesn't — show "Not on
//     Mesita yet" + nudge users to ping us.
//   - web_listed: Mesita has a web-listed (unclaimed) entry — show
//     "Listed · unclaimed" so consumers know they can still see the
//     basic profile.
//   - verified_partner_other: A claimed partner row — primary CTA.
//   - verified_partner_self: The caller owns this venue.
export type PlacePredictionStatus =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PlacePredictionStatus;
};

/**
 * Google Places autocomplete + Mesita merge for the consumer
 * /discover/search picker. Calls consumer-suggest-places, which
 * forwards to atlas-suggest-venue. Mirrors the business /add page
 * mechanic — same shape, same atlas pipeline — so a consumer can
 * find places that haven't onboarded to Mesita yet.
 */
export async function apiSuggestPlaces(
  client: SupabaseClient,
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];
  const { predictions } = await invokeEF<{ predictions: PlacePrediction[] }>(
    client,
    "consumer-suggest-places",
    { input: trimmed, sessionToken },
  );
  return predictions;
}

// Legacy rows may carry http:// photos. Next.js Image rejects them and
// would crash the whole page; filter to https before render.
function stripInsecurePhotos<T extends { photos: string[] }>(v: T): T {
  return { ...v, photos: v.photos.filter((p) => p.startsWith("https://")) };
}
