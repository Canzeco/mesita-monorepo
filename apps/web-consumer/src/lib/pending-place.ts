// The profile a guest sees before Mesita holds the place (MESITA-2307).
// A Google-only card's tap stashes the card it already holds; the route
// /place/g:<id> builds the profile from it through the same mapper the real
// profile uses, with Google's photo once the client has it.

import type { Place } from "@/lib/api/places";
import { placeRowToDetail } from "@/lib/adapters/place-to-detail";
import type { GooglePlaceFacts } from "@/lib/google-place-photo";
import type { PlaceDetail } from "@/lib/place-detail";

/** The draft's id wears the catalog stub's own prefix, so nothing that keys
 *  on a Mesita id (favorites, votes) can mistake it for a row. */
export const PENDING_PLACE_PREFIX = "g:";

/** What a Google-only card knows: the catalog stub's own columns, the name
 *  the one thing a card always has. */
export type PendingPlaceCard = Partial<Place> & {
  name: string;
  distance_km?: number | null;
  google_stars_overall?: number | null;
  google_review_count?: number | null;
};

const STASH_PREFIX = "mesita:pending-place:";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function stashPendingPlace(gid: string, card: PendingPlaceCard): void {
  try {
    storage()?.setItem(STASH_PREFIX + gid, JSON.stringify(card));
  } catch {
    // A blocked store only costs the first draft: the screen then draws
    // Google's own name and photo.
  }
}

/** The stashed card's raw text, a stable primitive for a store snapshot. */
export function readPendingPlaceRaw(gid: string): string | null {
  try {
    return storage()?.getItem(STASH_PREFIX + gid) ?? null;
  } catch {
    return null;
  }
}

export function parsePendingPlace(raw: string | null): PendingPlaceCard | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const name = (parsed as { name?: unknown }).name;
    return typeof name === "string" && name.trim()
      ? (parsed as PendingPlaceCard)
      : null;
  } catch {
    return null;
  }
}

export function clearPendingPlace(gid: string): void {
  try {
    storage()?.removeItem(STASH_PREFIX + gid);
  } catch {
    // Nothing to clear.
  }
}

/** The first draft of the profile: the card's facts (name, category,
 *  families, stars, address, distance) plus Google's photo, name and
 *  address once fetched. Not Enriched, nothing to vote on. */
export function pendingPlaceDetail(
  gid: string,
  card: PendingPlaceCard | null,
  fallbackName: string,
  google: GooglePlaceFacts,
): PlaceDetail {
  const name = card?.name ?? (fallbackName.trim() || null) ?? google.name ??
    "New place";
  const row: Record<string, unknown> = {
    ...card,
    id: `${PENDING_PLACE_PREFIX}${gid}`,
    slug: gid,
    google_place_id: gid,
    name,
    google_name: name,
    mesita_name: null,
    address: card?.address ?? google.address ?? null,
    photos: google.photoUrl ? [google.photoUrl] : [],
    google_stars_overall: card?.google_stars_overall ?? card?.google_rating ?? null,
    google_review_count: card?.google_review_count ?? card?.google_count ?? null,
    content_state: "ready",
    enriched_at: null,
    is_enriched: false,
    request_count: 0,
    created_at: card?.created_at ?? new Date().toISOString(),
  };
  const detail = placeRowToDetail(row as Parameters<typeof placeRowToDetail>[0]);
  return {
    ...detail,
    distance_km: card?.distance_km ?? detail.distance_km,
  };
}
