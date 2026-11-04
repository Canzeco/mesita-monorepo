// Update Reviews for one place (MESITA-3159, Pato: "Update Reviews… updates
// instagram followers number and facebook followers number and pulls 100
// reviews from apify"): the Reviews Sync — Google stars and count, the Apify
// review list, Instagram and Facebook followers (runPlaceSync) — written to
// the place in one write. Business' Reviews Sync
// (business-web-reload-place-reviews, source "sync"), admin's
// admin-web-update-place-reviews and the every-N-views trigger
// (consumer-web-track-activity) all run this.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writePlace } from "./place-doc.ts";
import { runPlaceSync } from "./place-sync-run.ts";

export type ReviewsUpdateResult =
  | { ok: true; synced: Awaited<ReturnType<typeof runPlaceSync>> }
  | { ok: false; status: number; error: string };

export async function runReviewsUpdate(admin: SupabaseClient, placeId: string): Promise<ReviewsUpdateResult> {
  const { data, error } = await admin
    .from("place_profiles")
    .select("id, google_place_id, instagram_url, facebook_url")
    .eq("id", placeId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!data) return { ok: false, status: 404, error: "Place not found" };
  const place = data as { google_place_id: string | null; instagram_url: string | null; facebook_url: string | null };
  const synced = await runPlaceSync({
    googlePlaceId: place.google_place_id,
    instagramUrl: place.instagram_url,
    facebookUrl: place.facebook_url,
  });
  // These are the saved links, so no link means nothing to be found: clearing
  // one turns its Found off (MESITA-3247). Sync itself writes nothing for a
  // missing link, because Enrich passes only the links its run found.
  const patch = {
    ...synced.patch,
    ...(place.instagram_url?.trim() ? {} : { instagram_found: false }),
    ...(place.facebook_url?.trim() ? {} : { facebook_found: false }),
  };
  const written = await writePlace(admin, { table: "place_profiles", mode: "update", id: placeId, patch });
  if (!written.ok) return { ok: false, status: 500, error: written.error };
  return { ok: true, synced };
}
