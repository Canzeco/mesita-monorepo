// Swipe deck progress — WHICH cards the guest already went through, never the
// cards themselves.
//
// v1 stored the whole `Place[]` runtime deck and restored it over the freshly
// fetched server deck on mount. That made the snapshot authoritative for card
// CONTENT, so a place enriched after the snapshot was written kept rendering
// its pre-enrichment values — an "Undefined" category on a place that had long
// since been enriched, surviving every reload for the life of the tab.
//
// v2 stores ids only. A fresh random deck is re-fetched on every load and is
// the single source of truth for what a card says; the snapshot only skips
// what the guest already swiped, so their position survives a refresh without
// freezing the data behind it.

const SWIPE_STATE_STORAGE_KEY = "mesita_swipe_progress_v2";

// The v1 key still sits in sessionStorage for anyone mid-session across this
// deploy. Removed on first read so a stale deck can't linger.
const LEGACY_SWIPE_STATE_KEY = "mesita_swipe_state_v1";

type SwipeProgress = {
  /** Place ids already swiped past, oldest first. */
  seenIds: string[];
};

// A guest who swipes for a long time shouldn't grow this without bound.
const MAX_SEEN = 500;

export function readSwipeProgress(): SwipeProgress | null {
  if (typeof window === "undefined") return null;
  try {
    window.sessionStorage.removeItem(LEGACY_SWIPE_STATE_KEY);
    const raw = window.sessionStorage.getItem(SWIPE_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SwipeProgress;
    if (!Array.isArray(parsed.seenIds)) return null;
    return {
      seenIds: parsed.seenIds.filter(
        (id): id is string => typeof id === "string",
      ),
    };
  } catch {
    return null;
  }
}

export function writeSwipeProgress(progress: SwipeProgress) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SWIPE_STATE_STORAGE_KEY,
      JSON.stringify({ seenIds: progress.seenIds.slice(-MAX_SEEN) }),
    );
  } catch {
    // ignore storage failures
  }
}

/**
 * Drop the stored progress — the next mount starts from the top of a fresh
 * deck. Used by Restart and by anything that discovers a card is stale (a
 * `place_not_found` when booking, e.g. after an admin reset re-created every
 * place under new uuids).
 */
export function clearSwipeProgress() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SWIPE_STATE_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_SWIPE_STATE_KEY);
  } catch {
    // ignore storage failures
  }
}
