"use client";

import { Navigation } from "lucide-react";

import { cn } from "@/lib/utils";
import { ActiveDot } from "./ActiveDot";
import { HEADER_DISC } from "./header-classes";

// The map's location control, TOP LEFT (Pato, 2026-10-17: "Location
// Searchbar Filters … location at the left"). A 44px disc wearing the
// navigation arrow and nothing else, mirrored by the Ask AI disc on the
// other side of the bar: both are HEADER_DISC, so the two can't drift apart
// (MESITA-2433). A dot on its corner says the guest's fix is held
// (MESITA-2304). No hover tint while it is locating and disabled.
//
// One tap, two meanings: with no fix yet it asks the browser for one (the
// permission prompt is the browser's); with a fix it recentres the camera
// on the guest. The accessible name says which.
export function SearchLocateButton({
  located,
  locating,
  onClick,
}: {
  located: boolean;
  locating: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locating}
      aria-busy={locating || undefined}
      aria-label={
        locating
          ? "Locating"
          : located
            ? "Recentre on your location"
            : "Use my location"
      }
      className={cn(
        "relative",
        HEADER_DISC,
        "disabled:hover:bg-card disabled:opacity-60",
      )}
    >
      <Navigation
        className={cn("h-4 w-4 shrink-0", locating && "animate-pulse")}
        strokeWidth={2}
        aria-hidden
      />
      {located ? <ActiveDot /> : null}
    </button>
  );
}
