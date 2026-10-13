// A changed Instagram or Facebook URL empties that reviews source in the
// same save (MESITA-2183). It does not scrape. The reload on the Reviews
// tab is the only fetch.
//
// The count null rides the profiles write (the view trigger copies
// instagram_followers_count and facebook_followers). reviews_state is not
// on the view, so it is a second write to place_profiles.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { writePlace } from "../_shared/place-doc.ts";
import {
  emptyReviewSource,
  normalizeReviewsState,
  socialSourcesToEmpty,
  withReviewSource,
  type ReviewsState,
  type SocialUrlPair,
} from "../_shared/reviews-state.ts";

export const REVIEWS_TILE_BODY_KEYS = [
  "google_stars_overall",
  "google_review_count",
  "instagram_followers_count",
  "facebook_followers",
  "reviews_state",
] as const;

/** A profile save must not carry the tile columns. The reload owns them. */
export function reviewsTileKeyInBody(body: object): string | null {
  for (const key of REVIEWS_TILE_BODY_KEYS) {
    if (key in body) return key;
  }
  return null;
}

type PrevSocial = SocialUrlPair & { reviews_state?: unknown };

export async function loadPreviousSocialUrls(
  admin: SupabaseClient,
  placeId: string,
  update: Record<string, unknown>,
): Promise<PrevSocial | null> {
  if (!("instagram_url" in update) && !("facebook_url" in update)) return null;
  const { data, error } = await admin
    .from("place_profiles")
    .select("instagram_url, facebook_url, reviews_state")
    .eq("id", placeId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[place-social] previous urls:", error.message);
    return null;
  }
  const row = data as {
    instagram_url: string | null;
    facebook_url: string | null;
    reviews_state: unknown;
  };
  return {
    instagram_url: row.instagram_url,
    facebook_url: row.facebook_url,
    reviews_state: row.reviews_state,
  };
}

/** Null the follower columns on `update` when the URL changed. */
export function applySocialCountClears(
  update: Record<string, unknown>,
  prev: PrevSocial | null,
): { instagram: boolean; facebook: boolean } {
  if (!prev) return { instagram: false, facebook: false };
  const clears = socialSourcesToEmpty(prev, {
    instagram_url: "instagram_url" in update ? (update.instagram_url as string | null) : undefined,
    facebook_url: "facebook_url" in update ? (update.facebook_url as string | null) : undefined,
  });
  if (clears.instagram) update.instagram_followers_count = null;
  if (clears.facebook) update.facebook_followers = null;
  return clears;
}

export async function writeClearedReviewsState(
  admin: SupabaseClient,
  placeId: string,
  prev: PrevSocial | null,
  clears: { instagram: boolean; facebook: boolean },
): Promise<ReviewsState | null> {
  if (!prev || (!clears.instagram && !clears.facebook)) return null;
  let state = normalizeReviewsState(prev.reviews_state);
  if (clears.instagram) state = withReviewSource(state, "instagram", emptyReviewSource());
  if (clears.facebook) state = withReviewSource(state, "facebook", emptyReviewSource());
  const res = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch: { reviews_state: state },
  });
  if (!res.ok) {
    console.error("[place-social] reviews_state:", res.error);
    return null;
  }
  return state;
}
