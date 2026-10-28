// Adapters around the one Sync. Callers decide whether to persist.

import { apifyActorError, apifyBillingDetail } from "./apify.ts";
import { gatherGoogleMaps } from "./enrich-google.ts";
import {
  googleReviewListFromScrape,
  type GoogleReviewSnippet,
} from "./enrich-google-review-snippets.ts";
import {
  syncSavedLinks,
  type PlaceSyncResult,
  type SyncLinks,
} from "./place-sync.ts";
import { verifyFacebook, verifyGoogle, verifyInstagram } from "./review-sources.ts";

export async function runPlaceSync(links: SyncLinks): Promise<PlaceSyncResult> {
  return await syncSavedLinks({
    links,
    fetchers: {
      googleSummary: async (googlePlaceId) => {
        const result = await verifyGoogle(googlePlaceId);
        if (!result.found) return { ok: false, error: result.reason ?? "Google did not respond" };
        return {
          ok: true,
          value: {
            stars: result.metrics.google_stars_overall,
            count: result.metrics.google_review_count,
          },
        };
      },
      instagramSummary: async (url) => {
        const result = await verifyInstagram(url);
        if (!result.found) return { ok: false, error: result.reason ?? "Instagram did not respond" };
        return { ok: true, value: { followers: result.metrics.instagram_followers_count } };
      },
      facebookSummary: async (url) => {
        const result = await verifyFacebook(url);
        if (!result.found) return { ok: false, error: result.reason ?? "Facebook did not respond" };
        return { ok: true, value: { followers: result.metrics.facebook_followers } };
      },
      googleReviews: async (googlePlaceId) => {
        const listed = await loadGoogleReviewList(googlePlaceId);
        if (listed.ok) return { ok: true, value: listed.list ?? [] };
        if (listed.reason === "unconfigured") return { ok: false, error: "Apify is not configured" };
        const error = listed.scrapeError;
        return {
          ok: false,
          error: apifyBillingDetail(error) ??
            (error ? apifyActorError(error) : "Google reviews could not be loaded"),
        };
      },
    },
  });
}

/** One Apify scrape of a place's Google review list. `unconfigured` = no
 *  APIFY_KEY; `failed` carries the scraper's own error, if it gave one, for
 *  the caller to word (Sync names it, admin's reload stays generic). */
export async function loadGoogleReviewList(
  googlePlaceId: string,
): Promise<
  | { ok: true; list: GoogleReviewSnippet[] | null }
  | { ok: false; reason: "unconfigured" | "failed"; scrapeError: string | null }
> {
  const key = Deno.env.get("APIFY_KEY")?.trim() ?? "";
  if (!key) return { ok: false, reason: "unconfigured", scrapeError: null };
  const gathered = await gatherGoogleMaps({
    apifyKey: key,
    placeId: googlePlaceId,
    gatherGoogleImages: 0,
  });
  const error = typeof gathered.diag.error === "string" ? gathered.diag.error : null;
  const listed = googleReviewListFromScrape(gathered.reviews, error);
  if (!listed.ok) return { ok: false, reason: "failed", scrapeError: error };
  return { ok: true, list: listed.list };
}
