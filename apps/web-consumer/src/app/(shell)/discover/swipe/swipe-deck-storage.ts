import type { Place } from "@/lib/api/places";

const SWIPE_STATE_STORAGE_KEY = "mesita_swipe_state_v1";

export type SwipeDeckSnapshot = {
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
