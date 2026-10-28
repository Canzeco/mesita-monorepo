// The card a guest tapped before Mesita holds the place (MESITA-2307). A
// Google-only card's tap stashes it; the opening route's generating view
// reads its name and address (MESITA-2935, the draft profile is gone).

import type { Place } from "@/lib/api/places";

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
    // A blocked store only costs the address: the screen then draws the
    // name the tap sent along.
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
