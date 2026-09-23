// The place's Instagram handle, as the ticket payloads written to
// consumer_notifications (the consumer's Pay inbox) carry it.

import { instagramHandleFromUrl } from "./apify.ts";

/** The place's bare Instagram handle for a ticket notification payload's
 *  `place_instagram_handle`, or null when the URL is missing or not a
 *  profile. */
export function placeInstagramHandleForPayload(
  instagramUrl: string | null | undefined,
): string | null {
  return instagramHandleFromUrl(instagramUrl);
}
