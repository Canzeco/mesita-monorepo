// Frontend API surface for venue Edge Functions.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper here calls exactly one Edge Function and never composes
//   multiple Edge Functions (composition belongs inside the function).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type VenueListingType = "partner" | "web";
export type VenueStatus = "lead" | "active" | "paused" | "archived";

export type FiscalType = "formal" | "informal";
// Three-plan venue catalog: Free (default) + one Pro plan per fiscal type.
// The Ultra tier was retired once the primary revenue stream moved to the
// guest side (Mesita class subscriptions). Anything beyond Pro is now a
// concierge / enterprise conversation, not a self-serve plan.
export type VenuePlan = "free" | "formal_pro" | "informal_pro";

// Weekly opening hours — JSONB column on venues. Lowercase English day keys,
// each holding an array of {open,close} ranges in 24h HH:MM. Closed days omit
// the key entirely. Multiple ranges per day support split shifts.
export type VenueHours = Partial<
  Record<
    "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
    { open: string; close: string }[]
  >
>;

export type Venue = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  vibe: string | null;
  price_level: number | null;
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
  photos: string[];
  menu_pdf_url: string | null;
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
  email: string | null;
  created_at: string;
};

export type MyVenue = Venue & {
  my_role: "owner" | "manager" | "staff";
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

export type EnrichmentReport = {
  google: boolean;
  photoCount: number;
  firecrawl: boolean;
  perplexity: boolean;
  openai: boolean;
  openaiError?: string | null;
  /** Number of channel columns (URLs + email) auto-classified from the
   *  enrichment pass. Lets the UI brag "We pulled 9 of your channels". */
  channelCount?: number;
};

// Discover surfaces (swipe + catalog) — both go through dedicated EFs
// that do bounding-box prefiltering + lazy embedding + RAG ranking. The
// helpers below are thin invokers; all the curation logic lives in the
// EFs so we can iterate on it without redeploying the web app.
export type RecommendDeckInput = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
};
export type RecommendDeckResponse = {
  deck: Venue[];
  summary: {
    candidates: number;
    embedded: number;
    intent?: string;
  };
};
export type CatalogCategory = {
  key: string;
  label: string;
  description: string;
  emoji: string;
  venues: Venue[];
};
export type RecommendCatalogInput = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  maxCategories?: number;
  perCategory?: number;
};
export type RecommendCatalogResponse = {
  categories: CatalogCategory[];
  summary: {
    candidates: number;
    embedded?: number;
    categoryCount: number;
  };
};

export async function apiFetchPublicVenues(
  client: SupabaseClient,
  limit = 50,
): Promise<Venue[]> {
  const { venues } = await invokeEF<{ venues: Venue[] }>(
    client,
    "guest-list-venues",
    { limit },
  );
  return venues.map(stripInsecurePhotos);
}

export async function apiGetVenue(
  client: SupabaseClient,
  idOrSlug: string,
): Promise<Venue | null> {
  try {
    const { venue } = await invokeEF<{ venue: Venue }>(
      client,
      "guest-get-venue",
      looksLikeUuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
    );
    return stripInsecurePhotos(venue);
  } catch (err) {
    // 404 → friendly empty state instead of a thrown error.
    if (err instanceof Error && /404/.test(err.message)) return null;
    throw err;
  }
}

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}

// Legacy rows may carry http:// photos. Next.js Image rejects them and
// would crash the whole page; filter to https before render.
function stripInsecurePhotos<T extends { photos: string[] }>(v: T): T {
  return { ...v, photos: v.photos.filter((p) => p.startsWith("https://")) };
}

export async function apiRecommendDeck(
  client: SupabaseClient,
  input: RecommendDeckInput = {},
): Promise<RecommendDeckResponse> {
  const data = await invokeEF<RecommendDeckResponse>(
    client,
    "guest-recommend-deck",
    input,
  );
  return {
    deck: data.deck.map(stripInsecurePhotos),
    summary: data.summary,
  };
}

export async function apiRecommendCatalog(
  client: SupabaseClient,
  input: RecommendCatalogInput = {},
): Promise<RecommendCatalogResponse> {
  const data = await invokeEF<RecommendCatalogResponse>(
    client,
    "guest-recommend-catalog",
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

export async function apiPlacesAutocomplete(
  client: SupabaseClient,
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];
  const { predictions } = await invokeEF<{ predictions: PlacePrediction[] }>(
    client,
    "manager-suggest-places",
    { input: trimmed, sessionToken },
    "Couldn't search venues right now.",
  );
  return predictions;
}

export type EnrichCreateVenueResponse = {
  venue: { id: string; slug: string; name: string; status: VenueStatus };
  enrichment: EnrichmentReport;
};

export async function apiEnrichCreateVenue(
  client: SupabaseClient,
  placeId: string,
): Promise<EnrichCreateVenueResponse> {
  return invokeEF<EnrichCreateVenueResponse>(
    client,
    "manager-create-unit",
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
  // Place-redesign editable surface (Manager-E=YES in Notion Components).
  description?: string | null;
  menu_pdf_url?: string | null;
  tags?: string[];
  whatsapp_pr_urls?: string[];
  instagram_pr_urls?: string[];
};

export type UpdatedVenue = Venue & {
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
    "manager-update-unit",
    input,
  );
  return venue;
}

// Destructive: drops the venue + every dependent row (tickets,
// cashback_ledger entries, venue_members, links). Only the venue's owner
// can call this; the EF rejects anyone else with 403. Returns the deleted
// id on success.
export async function apiDeleteVenue(
  client: SupabaseClient,
  id: string,
): Promise<{ id: string }> {
  return await invokeEF<{ id: string }>(client, "manager-delete-unit", { id });
}
