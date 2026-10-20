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

/** Optional member actions. A missing callback renders the control and does
 *  not run it. The consumer passes the live ones; admin passes none. */
export type PlaceActions = {
  onSave?: () => void;
  saved?: boolean;
  /** "I went" (MESITA-2442): marks a visit; tapping again takes it back. */
  onWent?: () => void;
  went?: boolean;
  onShare?: () => void;
  onReserve?: () => void;
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
