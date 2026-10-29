"use client";

import { useEffect } from "react";
import { LocateFixed } from "lucide-react";

import { cn } from "@/lib/utils";
import { MAP_USER_LOCATION_PIN_COLOR } from "@/lib/map-defaults";
import { toast } from "@/lib/toast";
import { LOCATION_HELP, type LocationError } from "@/lib/use-user-location";
import { HEADER_DISC } from "./header-classes";

// The map's location control, TOP LEFT (Pato, 2026-10-17: "Location
// Searchbar Filters … location at the left"). A 36px disc wearing the
// "my location" target and nothing else, mirrored by the Ask AI disc on the
// other side of the bar: both are HEADER_DISC, so the two can't drift apart
// (MESITA-2433). The target turns the map's you-are-here blue once the
// guest's fix is held (Pato, MESITA-2454: "a better icon for location, or
// add blue"; it was a black corner dot, MESITA-2304). No hover tint while
// it is locating and disabled. A refusal turns the icon red and toasts the
// same sentence Home's location sheet shows (LOCATION_HELP).
//
// One tap, two meanings: with no fix yet it asks the browser for one (the
// permission prompt is the browser's); with a fix it recentres the camera
// on the guest. The accessible name says which.
export function SearchLocateButton({
  located,
  locating,
  error,
  onClick,
}: {
  located: boolean;
  locating: boolean;
  error: LocationError | null;
  onClick: () => void;
}) {
  const blocked = error !== null && !located && !locating;
  useEffect(() => {
    if (!blocked || !error) return;
    toast(LOCATION_HELP[error], { tone: "error" });
  }, [blocked, error]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locating}
      data-active={located ? "true" : undefined}
      aria-busy={locating || undefined}
      aria-label={
        locating
          ? "Locating"
          : located
            ? "Recentre on your location"
            : blocked && error
              ? LOCATION_HELP[error]
              : "Use my location"
      }
      className={cn(
        "relative",
        HEADER_DISC,
        "disabled:hover:bg-card disabled:opacity-60",
      )}
    >
      <LocateFixed
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          locating && "animate-pulse",
          blocked && "text-destructive",
        )}
        strokeWidth={2}
        style={located ? { color: MAP_USER_LOCATION_PIN_COLOR } : undefined}
        aria-hidden
      />
    </button>
  );
}
