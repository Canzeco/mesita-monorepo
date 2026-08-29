// Consumer place Edge Function helpers — mirror of
// apps/web-consumer/src/lib/api/places.ts (recommend + list subset for swipe).

import type { SupabaseClient } from '@supabase/supabase-js';

import { placeRowToDetail, type ResolvedTag } from '@/lib/adapters/place-to-detail';
import { EFError, invokeEF } from '@/lib/ef';
import type { PlaceDetail } from '@/lib/types/place-detail';

type PlaceListingType = 'partner' | 'web';
type PlaceStatus = 'lead' | 'active' | 'paused' | 'archived';
type FiscalType = 'formal' | 'informal';
type PlacePlan = 'free' | 'pro' | 'ultra';

export type Place = {
  /** Server-computed: this place PAYS Mesita. Independent of promoting. */
  partner?: boolean | null;
  promoting?: boolean | null;
  id: string;
  slug: string;
  name: string;
  category: string | null;
  /** Super Category from the EF. Exactly one when classified. */
  family_keys?: string[];
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
  /**
   * True while Enricher is still building the profile
   * (`projects.content_status` ∈ {queued, generating}). Drives the
   * Enriching chip on swipe cards — same signal as place detail.
   */
  is_enriching?: boolean;
  products?: Record<string, unknown> | null;
  is_first_visit?: boolean | null;
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
  google_place_id?: string | null;
  from_google?: boolean;
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

export const SEARCH_NEARBY_LIMIT = 50;

/** Search map: nearest `limit` listed places to the pin. */
export async function apiFetchNearbyPlaces(
  client: SupabaseClient,
  origin: { lat: number; lng: number },
  limit = SEARCH_NEARBY_LIMIT,
): Promise<Place[]> {
  const { places } = await invokeEF<{ places: Place[] }>(
    client,
    'consumer-web-list-places',
    { lat: origin.lat, lng: origin.lng, limit },
  );
  return (places ?? []).map(stripInsecurePhotos);
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

export type SuggestPlacesMode = 'fast' | 'deep';

export async function apiSuggestPlaces(
  client: SupabaseClient,
  input: string,
  sessionToken: string,
  origin?: { lat: number; lng: number } | null,
  country?: string | null,
  mode: SuggestPlacesMode = 'fast',
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];
  const { predictions } = await invokeEF<{ predictions: PlacePrediction[] }>(
    client,
    'consumer-web-suggest-places',
    {
      input: trimmed,
      sessionToken,
      mode,
      ...(origin ? { lat: origin.lat, lng: origin.lng } : {}),
      ...(country ? { country } : {}),
    },
  );
  return predictions;
}

export async function apiFetchPlaceDetail(
  client: SupabaseClient,
  idOrSlug: string,
): Promise<PlaceDetail | null> {
  try {
    const { place, tags } = await invokeEF<{
      place: Record<string, unknown>;
      tags?: ResolvedTag[];
    }>(client, 'consumer-web-get-place', { id: idOrSlug }, 'Place not found');
    return place ? placeRowToDetail(place, tags) : null;
  } catch (err) {
    if (!(err instanceof EFError && err.status === 404)) {
      console.error(
        `[apiFetchPlaceDetail] consumer-get-place failed for "${idOrSlug}":`,
        err,
      );
    }
    return null;
  }
}

function stripInsecurePhotos<T extends { photos: string[] }>(v: T): T {
  return { ...v, photos: v.photos.filter((p) => p.startsWith('https://')) };
}

// Per-row status from consumer-web-suggest-places / ask-memo predictions.
type PlacePredictionStatus =
  | 'not_in_mesita'
  | 'web_listed'
  | 'verified_partner_other'
  | 'verified_partner_self';

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PlacePredictionStatus;
  partner?: boolean;
  mesitaId?: string;
  mesitaSlug?: string;
  lat?: number | null;
  lng?: number | null;
};
