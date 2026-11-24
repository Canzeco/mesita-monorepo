"use client";

import { useEffect } from "react";
import { LocateFixed } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { LOCATION_HELP, type LocationError } from "@/lib/use-user-location";
import { MAP_DISC, HEADER_ICON_STROKE } from "./header-classes";

// The map's location control: a 48px floating disc at the map's BOTTOM RIGHT,
// over the cards, where Google Maps keeps it and a thumb reaches (Pato,
// 2026-11-23, MESITA-4811: "think of 5 different designs and pick the best";
// left of Menu for an hour, MESITA-4800). It wears the "my location" target and
// nothing else, ink on white (MESITA-3004 took off MESITA-3000/3003's blue
// tint), always ink, located or not (Pato, MESITA-3010: "location instead of
// blue use black"; MESITA-2454 turned it the map's blue once a fix was held). No
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
        MAP_DISC,
        "disabled:hover:bg-card disabled:opacity-60",
      )}
    >
      <LocateFixed
        className={cn(
          "h-5 w-5 shrink-0",
          locating && "animate-pulse",
          blocked && "text-destructive",
        )}
        strokeWidth={HEADER_ICON_STROKE}
        aria-hidden
      />
    </button>
  );
}
