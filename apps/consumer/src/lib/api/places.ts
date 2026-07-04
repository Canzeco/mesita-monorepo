// Frontend API surface for the consumer-facing place Edge Functions.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper here calls exactly one Edge Function and never composes
//   multiple Edge Functions (composition belongs inside the function).
//
// Business-side helpers (places autocomplete, create / update / delete
// place, enrichment) live in the business app — consumer never invokes them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { EFError, invokeEF } from "./_invoke";
import { placeRowToDetail } from "@/lib/adapters/place-to-detail";
import type { ResolvedTag } from "@/lib/adapters/place-to-detail";
import type { PlaceDetail } from "@/lib/mock/place";

type PlaceListingType = "partner" | "web";
type PlaceStatus = "lead" | "active" | "paused" | "archived";
type FiscalType = "formal" | "informal";
// Five-plan place catalog: Free (default) + Pro and Ultra at each fiscal
// type. Every Verified Partner runs an instant discount applied at the bill.
type PlacePlan =
  | "free"
  | "formal_pro"
  | "formal_ultra"
  | "informal_pro"
  | "informal_ultra";

export type Place = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  category_label?: string | null;
  vibe: string | null;
  price_level: number | null;
  // ISO 4217 code from public.places.currency (default "MXN"). Every
  // monetary amount on this place — price ranges, reward caps,
  // future cover charges — is denominated in this currency so the
  // UI can render the right prefix ("MX$", "$", "€") without
  // hard-coding it.
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
  tiktok_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  opentable_url: string | null;
  resy_url: string | null;
  uber_eats_url: string | null;
  x_url: string | null;
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
  // places row (name, vibe, category, price_level, closes_at, reward).
  // The "all info on the tinder card too" checkpoint widens that to
  // mirror the place-detail overview grid. Every field below is
  // optional because the recommend-deck / list-places EFs don't return
  // them yet — the card hides cells when the field is null/undefined,
  // so the contract degrades cleanly until the EF starts populating
  // them (sourced from Google Places + cached on the row).
  google_rating?: number | null;
  google_count?: number | null;
  /** Place's Instagram follower count (read-only signal). */
  instagram_followers_count?: number | null;
  /** Pre-formatted with the currency prefix, e.g. "MX$200–300". */
  price_range?: string | null;
  /** Short relative timestamp like "2 days ago" (server-formatted). */
  last_updated_label?: string | null;
  open_now?: boolean | null;
  opens_at?: string | null;
  distance_km?: number | null;
  zone?: string | null;
  /** Per-visit reward ceiling in the place's currency. */
  reward_cap_mxn?: number | null;
  // Generic product payload. Menus are carried in products.menu.
  products?: Record<string, unknown> | null;
  /**
   * Whether this is the guest's first visit at this place. Drives the
   * ribbon copy:
   *   true  → "X% OFF welcome discount"
   *   false → "X% OFF return-visit discount"
   * Lean EFs leave this null; the ribbon falls back to first-visit
   * copy so a fresh consumer sees the welcome framing.
   */
  is_first_visit?: boolean | null;
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
  deck: Place[];
  summary: { candidates: number; embedded: number; intent?: string };
};
export type CatalogCategory = {
  key: string;
  label: string;
  description: string;
  emoji: string;
  places: Place[];
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

export async function apiFetchPublicPlaces(
  client: SupabaseClient,
  limit = 50,
): Promise<Place[]> {
  const { places } = await invokeEF<{ places: Place[] }>(
    client,
    "consumer-list-places",
    { limit },
  );
  return places.map(stripInsecurePhotos);
}

// Fetch one fully-enriched place (by uuid or slug) and adapt it into the
// rich PlaceDetail shape the detail modal renders. Returns null so the 4
// detail server components can fall back gracefully (redirect to swipe)
// instead of throwing into a 500 — the app has no error boundary. A genuine
// 404 is silent (expected); any other failure (401 expired session, 500 EF
// bug, network) is logged first so it stops masquerading invisibly as a
// deleted place.
export async function apiFetchPlaceDetail(
  client: SupabaseClient,
  idOrSlug: string,
): Promise<PlaceDetail | null> {
  try {
    const { place, tags } = await invokeEF<{
      place: Record<string, unknown>;
      tags?: ResolvedTag[];
    }>(client, "consumer-get-place", { id: idOrSlug }, "Place not found");
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
export async function apiRecommendDeck(
  client: SupabaseClient,
  input: RecommendDeckInput = {},
): Promise<RecommendDeckResponse> {
  const data = await invokeEF<RecommendDeckResponse>(
    client,
    "consumer-recommend-swipe",
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
    "consumer-recommend-map",
    input,
  );
  return {
    categories: data.categories.map((c) => ({
      ...c,
      places: c.places.map(stripInsecurePhotos),
    })),
    summary: data.summary,
  };
}
// Per-row status mirrored from atlas-suggest-places. Drives the badge
// in the consumer search picker:
//   - not_in_mesita: Google has it, Mesita doesn't — show "Not on
//     Mesita yet" + nudge users to ping us.
//   - web_listed: Mesita has a web-listed (unclaimed) entry — show
//     "Listed · unclaimed" so consumers know they can still see the
//     basic profile.
//   - verified_partner_other: A claimed partner row — primary CTA.
//   - verified_partner_self: The caller owns this place.
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
  // Forward-compatible Mesita identity: consumer-suggest-places is adding
  // these to its payload for on-Mesita rows. When present, clients navigate
  // via placeHref(slug ?? id) directly instead of the fuzzy name join.
  mesitaId?: string;
  mesitaSlug?: string;
};

type ConsumerCreatePlaceResponse = {
  place: { id: string; slug: string; name: string; status: PlaceStatus };
  enrichment: {
    google: boolean;
    photoCount: number;
    firecrawl: boolean;
    perplexity: boolean;
    openai: boolean;
  };
};

export type ConsumerCreatePlaceResult =
  | {
      kind: "created";
      place: { id: string; slug: string; name: string; status: PlaceStatus };
      message: string;
    }
  | {
      kind: "already_exists";
      message: string;
      existing: {
        id: string;
        slug: string | null;
        name: string | null;
        status: PlaceStatus | null;
        listing_type: PlaceListingType | null;
      } | null;
    };

/**
 * Google Places autocomplete + Mesita merge for the consumer
 * /discover/search picker. Calls consumer-suggest-places, which
 * forwards to atlas-suggest-places. Mirrors the business /add page
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

/**
 * Consumer-triggered place add.
 *
 * Intentionally reuses the same create pipeline as business onboarding,
 * but does NOT claim ownership: the function inserts a public web listing
 * (`listing_type=web`) with no place_members owner row.
 *
 * Returns a discriminated result rather than throwing on the expected
 * "already listed" case: the EF signals it with code `place_already_exists`
 * (as an `ok: false` body or a non-2xx FunctionsHttpError), which invokeEF
 * surfaces uniformly via EFError.code + EFError.body.
 */
export async function apiCreatePlaceAsConsumerResult(
  client: SupabaseClient,
  placeId: string,
): Promise<ConsumerCreatePlaceResult> {
  try {
    const data = await invokeEF<ConsumerCreatePlaceResponse>(
      client,
      "business-create-project",
      { placeId },
      "Couldn't add that place right now.",
    );
    return {
      kind: "created",
      place: data.place,
      message: `${data.place.name} is now listed on Mesita and visible to everyone.`,
    };
  } catch (err) {
    if (err instanceof EFError && err.code === "place_already_exists") {
      const bodyError =
        typeof err.body?.error === "string" ? err.body.error : null;
      return {
        kind: "already_exists",
        message:
          bodyError ??
          "This place is already on Mesita. If you manage it, contact support to claim ownership.",
        existing: normalizeExistingPlace(err.body?.existing),
      };
    }
    throw err;
  }
}

// Narrow the untyped `existing` blob off an EFError body into the shape the
// already_exists result promises.
function normalizeExistingPlace(
  raw: unknown,
): Extract<ConsumerCreatePlaceResult, { kind: "already_exists" }>["existing"] {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as {
    id?: string;
    slug?: string | null;
    name?: string | null;
    status?: PlaceStatus | null;
    listing_type?: PlaceListingType | null;
  };
  if (!e.id) return null;
  return {
    id: e.id,
    slug: e.slug ?? null,
    name: e.name ?? null,
    status: e.status ?? null,
    listing_type: e.listing_type ?? null,
  };
}

// Legacy rows may carry http:// photos. Next.js Image rejects them and
// would crash the whole page; filter to https before render.
function stripInsecurePhotos<T extends { photos: string[] }>(v: T): T {
  return { ...v, photos: v.photos.filter((p) => p.startsWith("https://")) };
}
