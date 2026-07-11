// Consumer place Edge Function helpers — mirror of
// apps/web-consumer/src/lib/api/places.ts (recommend + list subset for swipe).

import type { SupabaseClient } from '@supabase/supabase-js';

import { invokeEF } from '@/lib/ef';

type PlaceListingType = 'partner' | 'web';
type PlaceStatus = 'lead' | 'active' | 'paused' | 'archived';
type FiscalType = 'formal' | 'informal';
type PlacePlan = 'free' | 'pro' | 'ultra';

export type Place = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  category_label?: string | null;
  vibe: string | null;
  price_level: number | null;
  currency: string;
  listing_type: PlaceListingType;
  status: PlaceStatus;
  fiscal_type: FiscalType;
  plan: PlacePlan;
  lat: number | null;
  lng: number | null;
  address: string | null;
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
  didi_food_url: string | null;
  google_maps_url: string | null;
  email: string | null;
  created_at: string;
  google_rating?: number | null;
  google_count?: number | null;
  instagram_followers_count?: number | null;
  price_range?: string | null;
  last_updated_label?: string | null;
  open_now?: boolean | null;
  opens_at?: string | null;
  distance_km?: number | null;
  zone?: string | null;
  reward_cap_mxn?: number | null;
  products?: Record<string, unknown> | null;
  is_first_visit?: boolean | null;
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
};

type RecommendDeckInput = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
};

type RecommendDeckResponse = {
  deck: Place[];
  summary: { candidates: number; embedded: number; intent?: string };
};

export async function apiFetchPublicPlaces(
  client: SupabaseClient,
  limit = 50,
): Promise<Place[]> {
  const { places } = await invokeEF<{ places: Place[] }>(
    client,
    'consumer-web-list-places',
    { limit },
  );
  return places.map(stripInsecurePhotos);
}

export async function apiRecommendDeck(
  client: SupabaseClient,
  input: RecommendDeckInput = {},
): Promise<RecommendDeckResponse> {
  const data = await invokeEF<RecommendDeckResponse>(
    client,
    'consumer-web-recommend-swipe',
    input,
  );
  return { deck: data.deck.map(stripInsecurePhotos), summary: data.summary };
}

function stripInsecurePhotos<T extends { photos: string[] }>(v: T): T {
  return { ...v, photos: v.photos.filter((p) => p.startsWith('https://')) };
}

// Per-row status from consumer-web-suggest-places / ask-memo predictions.
export type PlacePredictionStatus =
  | 'not_in_mesita'
  | 'web_listed'
  | 'verified_partner_other'
  | 'verified_partner_self';

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PlacePredictionStatus;
  mesitaId?: string;
  mesitaSlug?: string;
};
