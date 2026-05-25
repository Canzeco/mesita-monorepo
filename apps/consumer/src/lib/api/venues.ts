// Frontend API surface for the consumer-facing venue Edge Functions.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper here calls exactly one Edge Function and never composes
//   multiple Edge Functions (composition belongs inside the function).
//
// Manager-side helpers (places autocomplete, create / update / delete
// venue, enrichment) live in the manager app — consumer never invokes them.

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

export async function apiGetVenue(
  client: SupabaseClient,
  idOrSlug: string,
): Promise<Venue | null> {
  try {
    const { venue } = await invokeEF<{ venue: Venue }>(
      client,
      "consumer-get-venue",
      looksLikeUuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
    );
    return stripInsecurePhotos(venue);
  } catch (err) {
    // 404 → friendly empty state instead of a thrown error.
    if (err instanceof Error && /404/.test(err.message)) return null;
    throw err;
  }
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
