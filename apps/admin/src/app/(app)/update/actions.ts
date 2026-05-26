"use server";

import { efInvoke } from "@/lib/supabase-ef";

// Default business web origin used when the env var isn't set on Vercel —
// production lives at business.mesita.ai today. Override per environment by
// setting BUSINESS_WEB_URL.
const BUSINESS_WEB_URL_FALLBACK = "https://business.mesita.ai";

type FoundVenue = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type EFResponse = { venue: FoundVenue | null };

export type FindVenueResult =
  | {
      ok: true;
      found: true;
      venue: FoundVenue;
      link: string;
    }
  | { ok: true; found: false; placeId: string }
  | { ok: false; error: string };

export async function findVenueByPlaceId(
  rawPlaceId: string,
): Promise<FindVenueResult> {
  const placeId = (rawPlaceId ?? "").trim();
  if (!placeId) {
    return { ok: false, error: "Paste a Google Place ID first." };
  }

  const result = await efInvoke<EFResponse>("admin-find-venue", { placeId });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const venue = result.data.venue;
  if (!venue) {
    return { ok: true, found: false, placeId };
  }

  // Clean URL — the operator opens this in a fresh tab, the business web's
  // middleware sees no session and bounces through / (the auth surface)
  // if needed. Once signed in (as themselves, via Google), the
  // business-get-overview EF reads their JWT, finds their email in
  // super_admins, and grants venue access regardless of venue_members.
  const businessOrigin =
    (process.env.BUSINESS_WEB_URL ?? "").trim() || BUSINESS_WEB_URL_FALLBACK;
  const link = `${businessOrigin.replace(/\/$/, "")}/unit/${encodeURIComponent(venue.id)}/home`;
  return { ok: true, found: true, venue, link };
}
