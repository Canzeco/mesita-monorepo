import type { Place } from "@/lib/api/places";

const SWIPE_STATE_STORAGE_KEY = "mesita_swipe_state_v1";

type SwipeDeckSnapshot = {
  runtimeDeck: Place[];
  idx: number;
};

export function readSwipeSnapshot(): SwipeDeckSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SWIPE_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SwipeDeckSnapshot;
    if (!Array.isArray(parsed.runtimeDeck)) return null;
    if (typeof parsed.idx !== "number") return null;
    return {
      runtimeDeck: parsed.runtimeDeck,
      idx: Math.max(0, Math.floor(parsed.idx)),
    };
  } catch {
    return null;
  }
}

export function writeSwipeSnapshot(snapshot: SwipeDeckSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SWIPE_STATE_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // ignore storage failures
  }
}

/**
 * Drop the cached deck. The snapshot outlives the rows it describes — an admin
 * reset re-creates places under FRESH uuids — so a stored card can point at a
 * project_id the backend no longer has. Anything that discovers a card is
 * stale (a `place_not_found` when booking) clears it; the next mount refetches.
 */
export function clearSwipeSnapshot() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SWIPE_STATE_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}
