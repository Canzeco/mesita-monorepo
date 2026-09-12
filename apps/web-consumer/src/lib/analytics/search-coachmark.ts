// MESITA-1610 shipped the one-shot Search-tab coach mark; MESITA-1694 is
// the follow-up that makes its dismiss measurable. The localStorage flag
// never reaches the server, so `nav_tab_tap` with tab Search cannot tell a
// real Search tap from the auto-timer writing the same key.

export const SEARCH_COACHMARK_STORAGE_KEY = "mesita:search-tab-coachmark-seen";
export const SEARCH_COACHMARK_AUTO_DISMISS_MS = 5500;

export type SearchCoachmarkDismissReason = "timer" | "tap";

/** Same one-shot shape as SwipeDeck's tutorial flag — a new key, no
 * legacy value to migrate. */
export function readSearchCoachmarkSeen(): boolean {
  try {
    return window.localStorage.getItem(SEARCH_COACHMARK_STORAGE_KEY) != null;
  } catch {
    /* private mode / blocked storage */
  }
  return false;
}

export function writeSearchCoachmarkSeen(): void {
  try {
    window.localStorage.setItem(SEARCH_COACHMARK_STORAGE_KEY, "1");
  } catch {
    /* best-effort */
  }
}

/** First close wins. A Search tap after the bubble is already gone (or
 * never shown) must not mint a dismiss row — that would inflate tap rate
 * against every later Search visit. The timer always records unless a tap
 * already did, matching BottomNav's original write-the-flag-either-way. */
export function shouldRecordSearchCoachmarkDismiss(args: {
  alreadyRecorded: boolean;
  showing: boolean;
  reason: SearchCoachmarkDismissReason;
}): boolean {
  if (args.alreadyRecorded) return false;
  if (args.reason === "tap" && !args.showing) return false;
  return true;
}
