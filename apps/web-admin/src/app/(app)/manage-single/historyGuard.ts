/**
 * Pure state machine for the dirty-navigation history trap.
 *
 * Browser Back unmounts the active section first (App Router), which clears
 * dirtyMap via useEffect cleanup — a naive popstate listener then sees
 * isDirty===false and lets the navigation through. The trap must re-assert
 * the URL and open the discard dialog before relying on mounted section state.
 */

export type HistoryGuardState = {
  /** We pushed a sentinel while dirty. */
  trapping: boolean;
  /** Discard dialog opened from a Back attempt. */
  dialogOpen: boolean;
  /** Next popstate is the intentional leave after Confirm. */
  allowNextPop: boolean;
};

export type HistoryGuardEvent =
  | { type: "dirty-on" }
  | { type: "dirty-off" }
  | { type: "popstate" }
  | { type: "confirm-leave" }
  | { type: "cancel-leave" };

export type HistoryGuardEffect = "push-sentinel" | "reassert" | "back";

export const INITIAL_HISTORY_GUARD: HistoryGuardState = {
  trapping: false,
  dialogOpen: false,
  allowNextPop: false,
};

export function reduceHistoryGuard(
  state: HistoryGuardState,
  event: HistoryGuardEvent,
): { state: HistoryGuardState; effects: HistoryGuardEffect[] } {
  switch (event.type) {
    case "dirty-on": {
      if (state.trapping) return { state, effects: [] };
      return {
        state: { ...state, trapping: true },
        effects: ["push-sentinel"],
      };
    }
    case "dirty-off": {
      if (!state.trapping && !state.dialogOpen && !state.allowNextPop) {
        return { state, effects: [] };
      }
      return { state: INITIAL_HISTORY_GUARD, effects: [] };
    }
    case "popstate": {
      if (state.allowNextPop) {
        return {
          state: INITIAL_HISTORY_GUARD,
          effects: [],
        };
      }
      if (state.trapping) {
        return {
          state: { ...state, dialogOpen: true },
          effects: ["reassert"],
        };
      }
      return { state, effects: [] };
    }
    case "confirm-leave": {
      return {
        state: {
          trapping: false,
          dialogOpen: false,
          allowNextPop: true,
        },
        effects: ["back"],
      };
    }
    case "cancel-leave": {
      return {
        state: { ...state, dialogOpen: false },
        effects: [],
      };
    }
    default:
      return { state, effects: [] };
  }
}
