"use client";

import { useEffect } from "react";
import { LocateFixed } from "lucide-react";

import { cn } from "@/lib/utils";
import { MAP_USER_LOCATION_PIN_COLOR } from "@/lib/map-defaults";
import { toast } from "@/lib/toast";
import { LOCATION_HELP, type LocationError } from "@/lib/use-user-location";
import { HEADER_DISC } from "./header-classes";

// The map's location control: a 36px bubble at the RIGHT END of Search's
// long bar, after Ask AI (Pato, MESITA-2999: "move the location to the
// right … search · ask bubble · loc bubble"; it was a disc at the top left,
// 2026-10-17). It wears the "my location" target and nothing else, on the
// bar's grey bubble (MESITA-3004 took off MESITA-3000/3003's blue tint): ink,
// turning the map's you-are-here blue once a fix is held (MESITA-2454). No
// hover tint while it is locating and disabled. A refusal turns the icon red and toasts the
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
        "disabled:hover:bg-muted disabled:opacity-60",
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
