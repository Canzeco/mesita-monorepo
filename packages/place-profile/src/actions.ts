import type { MouseEvent } from "react";

import type { PlaceDetail } from "./place-detail";

export type PlaceMenuItem = PlaceDetail["products"]["menu"][number];

export type PlaceRequestView = {
  count: number;
  threshold: number;
  requested: boolean;
  enriching: boolean;
  pending: boolean;
  error: string | null;
};

/** The profile is on screen before Mesita holds it — a Google-only card the
 *  guest opened (MESITA-2307). The Enrich slot says the profile is being
 *  created, or why it could not be. */
export type PlaceCreatingView = {
  error: string | null;
  /** Runs the create again after a refusal; absent, the panel only says why. */
  onRetry?: () => void;
};

/** One requestable time on the Reserve row (MESITA-2633): a place date
 *  `YYYY-MM-DD` and a wall-clock `HH:mm`. A REQUEST, never a confirmed
 *  table: Mesita books by calling the place. */
export type PlaceReserveSlot = { date: string; time: string };

/** Optional member actions. A missing callback renders the control and does
 *  not run it. The consumer passes the live ones; admin passes none. */
export type PlaceActions = {
  onSave?: () => void;
  saved?: boolean;
  onContact?: () => void;
  onShare?: () => void;
  /** Opens the reservation sheet; with a slot, seeded to that date and
   *  time (a tapped time on the Reserve row). */
  onReserve?: (slot?: PlaceReserveSlot) => void;
  /** The next requestable times, all on one day, ascending (MESITA-2633).
   *  Absent or empty: the Reserve row draws Reserve alone. */
  reserveSlots?: PlaceReserveSlot[];
  /** That day, as the guest reads it: "Today", "Tomorrow", "Friday". */
  reserveDayLabel?: string;
  onRequest?: () => void;
  onOpenMenu?: (menu: PlaceMenuItem) => void;
  onOpenLink?: (url: string) => void;
  request?: PlaceRequestView;
};

export function inertButtonProps(live: boolean): {
  tabIndex?: -1;
  "aria-disabled"?: true;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
} {
  if (live) return {};
  return {
    tabIndex: -1,
    "aria-disabled": true,
    onClick: (event) => event.preventDefault(),
  };
}
