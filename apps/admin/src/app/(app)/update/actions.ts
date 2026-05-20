"use server";

import { getAdminKey } from "@/lib/admin-key";
import { efInvoke } from "@/lib/supabase-ef";

// Default manager web origin used when the env var isn't set on Vercel —
// production lives at manager.mesita.ai today. Override per environment by
// setting MANAGER_WEB_URL.
const MANAGER_WEB_URL_FALLBACK = "https://manager.mesita.ai";

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

export async function findVenueForSuperAdmin(
  rawPlaceId: string,
): Promise<FindVenueResult> {
  const placeId = (rawPlaceId ?? "").trim();
  if (!placeId) {
    return { ok: false, error: "Paste a Google Place ID first." };
  }

  const adminKey = await getAdminKey();
  if (!adminKey) {
    return {
      ok: false,
      error: "Admin key isn't set on this device. Sign in at /login.",
    };
  }

  const result = await efInvoke<EFResponse>("admin-find-venue", { placeId });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const venue = result.data.venue;
  if (!venue) {
    return { ok: true, found: false, placeId };
  }

  const managerOrigin =
    (process.env.MANAGER_WEB_URL ?? "").trim() || MANAGER_WEB_URL_FALLBACK;
  const link = `${managerOrigin.replace(/\/$/, "")}/super-admin/enter?token=${encodeURIComponent(adminKey)}&unitId=${encodeURIComponent(venue.id)}`;
  return { ok: true, found: true, venue, link };
}
