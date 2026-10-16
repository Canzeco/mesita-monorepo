// Adapters around the one Sync. Callers decide whether to persist.

import { gatherGoogleMaps } from "./enrich-google.ts";
import { googleReviewListFromScrape } from "./enrich-google-review-snippets.ts";
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
        const key = Deno.env.get("APIFY_KEY")?.trim() ?? "";
        if (!key) return { ok: false, error: "Apify is not configured" };
        const gathered = await gatherGoogleMaps({
          apifyKey: key,
          placeId: googlePlaceId,
          gatherGoogleImages: 0,
        });
        const error = typeof gathered.diag.error === "string" ? gathered.diag.error : null;
        const listed = googleReviewListFromScrape(gathered.reviews, error);
        if (!listed.ok) return { ok: false, error: "Google reviews could not be loaded" };
        return { ok: true, value: listed.list ?? [] };
      },
    },
  });
}
